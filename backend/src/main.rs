use axum::{
    extract::{Path, State, FromRequestParts, Query},
    http::{request::Parts, StatusCode},
    response::IntoResponse,
    routing::{get, post, delete, patch},
    Json, Router,
};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use bcrypt::{hash, verify, DEFAULT_COST};
use tower_http::cors::{Any, CorsLayer};
use serde_json::json;
use sqlx::{postgres::{PgPoolOptions, PgConnectOptions}, PgPool, Row};
use std::str::FromStr;
use dotenv::dotenv;
use reqwest::StatusCode as HttpStatusCode;
use serde::{Serialize, Deserialize};

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool, // handler Supabase
}

#[tokio::main]
async fn main() {
    dotenv().ok();

    let mut db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    
    // Forcer l'utilisation du Session Pooler de Supabase (Port 5432) au lieu de PgBouncer (Port 6543)
    // SQLx ne supporte pas bien PgBouncer en mode transaction avec les prepared statements.
    if db_url.contains(":6543") {
        db_url = db_url.replace(":6543", ":5432");
        db_url = db_url.replace("?pgbouncer=true", "");
    }
    
    let connect_options = PgConnectOptions::from_str(&db_url)
        .expect("Invalid DATABASE_URL")
        .statement_cache_capacity(0); // FIX SUPABASE PGBOUNCER ERROR

    let pool = match PgPoolOptions::new()
        .max_connections(10)
        .connect_with(connect_options)
        .await
    {
        Ok(pool) => {
            println!("Connected to DB successfully");
            pool
        }
        Err(err) => {
            println!("Failed to connect to DB: {}", err);
            std::process::exit(1);
        }
    };

    let state = AppState { db: pool };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api", get(hello_world))
        .route("/api/products/count", get(get_products_count))
        .route("/api/products/{barcode}", get(get_products_by_barcode).delete(delete_product))
        .route("/api/products", get(get_products).post(create_product))
        .route("/api/products/openfoodfacts/{barcode}", get(get_products_by_barcode_from_openfoodfacts))
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/users", get(get_users))
        .route("/api/users/{id}", delete(delete_user))
        .route("/api/users/{id}/role", patch(update_user_role))
        .route("/api/scans", get(get_user_scans).post(add_user_scan))
        .with_state(state)
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3003").await.unwrap();
    println!("Server started successfully at http://0.0.0.0:3003");
    axum::serve(listener, app).await.unwrap();
}

async fn hello_world() -> impl IntoResponse {
    let json_response = json!({
        "status": "ok",
        "message": "API Kayu en ligne !"
    });
    Json(json_response)
}


#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct Product {
    pub barcode: String,
    pub name: String,
    pub brand: Option<String>,
    pub image_url: Option<String>,
    pub nutriscore: Option<String>,
    pub ecoscore: Option<String>,
    pub ingredients_text: Option<String>,
    pub additives_count: Option<i32>,
}

async fn get_products_by_barcode(Path(barcode): Path<String>, State(state): State<AppState>) -> impl IntoResponse {
    let result = sqlx::query_as::<_, Product>(
        "SELECT barcode, name, brand, image_url, nutriscore, ecoscore, ingredients_text, additives_count FROM products WHERE barcode = $1"
    )
    .bind(barcode)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(product)) => {
            Json(json!({
                "status": "ok",
                "product": product
            })).into_response()
        }
        Ok(None) => {
            (
                axum::http::StatusCode::NOT_FOUND,
                Json(json!({ "status": "error", "message": "Produit non trouvé" }))
            ).into_response()
        }
        Err(e) => {
            eprintln!("Erreur DB: {}", e);
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "status": "error", "message": "Erreur serveur" }))
            ).into_response()
        }
    }
}   


async fn get_products_count(State(state): State<AppState>) -> impl IntoResponse {
    let result = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM products")
        .fetch_one(&state.db)
        .await;

    match result {
        Ok(count) => {
            let json_response = json!({
                "status": "ok",
                "total_products": count
            });
            Json(json_response).into_response()
        }
        Err(e) => {
            let json_response = json!({
                "status": "error",
                "message": format!("Erreur DB: {}", e)
            });
            (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json_response)).into_response()
        }
    }
}


#[derive(Debug, Deserialize, Serialize)]
pub struct OffResponse {
    pub status: i32, // 1 si trouvé, 0 sinon
    pub code: Option<String>,
    pub product: Option<ProductInfo>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductInfo {
    pub product_name_fr: Option<String>,
    pub product_name: Option<String>,
    pub brands: Option<String>,
    pub quantity: Option<String>,
    pub image_front_url: Option<String>,
    pub nutriscore_grade: Option<String>,
    pub ecoscore_grade: Option<String>,
    pub nova_group: Option<i32>,
    pub ingredients_text_fr: Option<String>,
}

async fn get_products_by_barcode_from_openfoodfacts(
    Path(barcode): Path<String>, 
    State(_state): State<AppState>
) -> impl IntoResponse {
    let url = format!("https://world.openfoodfacts.org/api/v2/product/{}.json", barcode);
    
    match reqwest::get(&url).await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<OffResponse>().await {
                    Ok(off_data) => {
                        if off_data.status == 1 && off_data.product.is_some() {
                            Json(json!({
                                "status": "ok",
                                "data": off_data.product.unwrap()
                            })).into_response()
                        } else {
                            (
                                HttpStatusCode::NOT_FOUND,
                                Json(json!({ "status": "error", "message": "Produit non trouvé sur OpenFoodFacts" }))
                            ).into_response()
                        }
                    }
                    Err(e) => {
                        eprintln!("Erreur parsing JSON ciblée: {}", e);
                        (
                            HttpStatusCode::INTERNAL_SERVER_ERROR,
                            Json(json!({ "status": "error", "message": "Erreur lors de l'extraction des données" }))
                        ).into_response()
                    }
                }
            } else {
                (
                    HttpStatusCode::BAD_GATEWAY,
                    Json(json!({ "status": "error", "message": "Erreur avec le service OpenFoodFacts" }))
                ).into_response()
            }
        }
        Err(e) => {
            eprintln!("Erreur requête HTTP: {}", e);
            (
                HttpStatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "status": "error", "message": "Erreur réseau interne" }))
            ).into_response()
        }
    }
}

// --- Auth & Users ---
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // user id
    pub role: String,
    pub exp: usize,
}

impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, Json<serde_json::Value>);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.strip_prefix("Bearer "));

        let token = match auth_header {
            Some(token) => token,
            None => {
                return Err((
                    StatusCode::UNAUTHORIZED,
                    Json(json!({ "status": "error", "message": "Missing token" })),
                ));
            }
        };

        let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
        
        match decode::<Claims>(
            token,
            &DecodingKey::from_secret(secret.as_bytes()),
            &Validation::default(),
        ) {
            Ok(token_data) => Ok(token_data.claims),
            Err(_) => Err((
                StatusCode::UNAUTHORIZED,
                Json(json!({ "status": "error", "message": "Invalid token" })),
            )),
        }
    }
}

pub struct AdminClaims(pub Claims);

impl<S> FromRequestParts<S> for AdminClaims
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, Json<serde_json::Value>);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let claims = Claims::from_request_parts(parts, state).await?;
        if claims.role != "admin" {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "status": "error", "message": "Accès administrateur requis" })),
            ));
        }
        Ok(AdminClaims(claims))
    }
}

#[derive(Deserialize)]
pub struct AuthPayload {
    pub email: String,
    pub password: String,
}

async fn register(State(state): State<AppState>, Json(payload): Json<AuthPayload>) -> impl IntoResponse {
    if payload.email.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "status": "error", "message": "L'email ne peut pas être vide" }))).into_response();
    }
    if payload.password.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "status": "error", "message": "Le mot de passe ne peut pas être vide" }))).into_response();
    }

    let password_hash = hash(&payload.password, DEFAULT_COST).unwrap();

    let result = sqlx::query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id"
    )
    .bind(&payload.email)
    .bind(&password_hash)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(_) => (StatusCode::CREATED, Json(json!({ "status": "ok", "message": "User created" }))).into_response(),
        Err(_) => (StatusCode::BAD_REQUEST, Json(json!({ "status": "error", "message": "Email already exists" }))).into_response(),
    }
}

async fn login(State(state): State<AppState>, Json(payload): Json<AuthPayload>) -> impl IntoResponse {
    let user_result = sqlx::query(
        "SELECT id, password_hash, role FROM users WHERE email = $1"
    )
    .bind(&payload.email)
    .fetch_optional(&state.db)
    .await;

    let user = match user_result {
        Ok(u) => u,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "message": format!("DB error: {}", e) }))).into_response(),
    };

    if let Some(row) = user {
        let user_id: uuid::Uuid = row.get("id");
        let password_hash: String = row.get("password_hash");
        let role: String = row.get("role");

        if verify(&payload.password, &password_hash).unwrap_or(false) {
            let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
            let claims = Claims {
                sub: user_id.to_string(),
                role: role.clone(),
                exp: (chrono::Utc::now() + chrono::Duration::hours(24)).timestamp() as usize,
            };
            let token = encode(
                &Header::default(),
                &claims,
                &EncodingKey::from_secret(secret.as_bytes()),
            ).unwrap();

            return Json(json!({ "status": "ok", "token": token, "role": role })).into_response();
        }
    }

    (StatusCode::UNAUTHORIZED, Json(json!({ "status": "error", "message": "Invalid credentials" }))).into_response()
}

#[derive(Serialize, sqlx::FromRow)]
pub struct UserResponse {
    pub id: uuid::Uuid,
    pub email: String,
    pub role: String,
}

#[derive(Deserialize)]
pub struct Pagination {
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

async fn get_users(_admin: AdminClaims, State(state): State<AppState>, Query(params): Query<Pagination>) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(10).clamp(1, 100);
    let page = params.page.unwrap_or(1).max(1);
    let offset = (page - 1) * limit;

    let users = sqlx::query_as::<_, UserResponse>("SELECT id, email, role FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2")
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    Json(json!({ "status": "ok", "users": users })).into_response()
}

async fn delete_user(_admin: AdminClaims, Path(id): Path<uuid::Uuid>, State(state): State<AppState>) -> impl IntoResponse {
    let result = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await;
    match result {
        Ok(_) => Json(json!({ "status": "ok", "message": "User deleted" })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "message": format!("Error deleting user: {}", e) }))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct UpdateRolePayload {
    pub role: String,
}

async fn update_user_role(_admin: AdminClaims, Path(id): Path<uuid::Uuid>, State(state): State<AppState>, Json(payload): Json<UpdateRolePayload>) -> impl IntoResponse {
    if payload.role != "admin" && payload.role != "user" {
        return (StatusCode::BAD_REQUEST, Json(json!({ "status": "error", "message": "Invalid role" }))).into_response();
    }
    
    let result = sqlx::query("UPDATE users SET role = $1 WHERE id = $2")
        .bind(&payload.role)
        .bind(id)
        .execute(&state.db)
        .await;

    match result {
        Ok(_) => Json(json!({ "status": "ok", "message": "Role updated" })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "message": format!("Error updating role: {}", e) }))).into_response(),
    }
}

// --- Scans ---
#[derive(Deserialize)]
pub struct ScanPayload {
    pub barcode: String,
    pub product_name: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct ScanResponse {
    pub id: uuid::Uuid,
    pub barcode: String,
    pub product_name: Option<String>,
    pub scanned_at: Option<chrono::DateTime<chrono::Utc>>,
}

async fn add_user_scan(claims: Claims, State(state): State<AppState>, Json(payload): Json<ScanPayload>) -> impl IntoResponse {
    let user_id = uuid::Uuid::parse_str(&claims.sub).unwrap();

    let result = sqlx::query(
        "INSERT INTO user_scans (user_id, barcode, product_name) VALUES ($1, $2, $3)"
    )
    .bind(user_id)
    .bind(&payload.barcode)
    .bind(&payload.product_name)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => Json(json!({ "status": "ok", "message": "Scan recorded" })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "message": format!("DB error: {}", e) }))).into_response(),
    }
}

async fn get_user_scans(claims: Claims, State(state): State<AppState>) -> impl IntoResponse {
    let user_id = uuid::Uuid::parse_str(&claims.sub).unwrap();

    let scans = sqlx::query_as::<_, ScanResponse>(
        "SELECT id, barcode, product_name, scanned_at FROM user_scans WHERE user_id = $1 ORDER BY scanned_at DESC LIMIT 50"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(json!({ "status": "ok", "scans": scans })).into_response()
}

// --- Admin Product CRUD ---
async fn create_product(_admin: AdminClaims, State(state): State<AppState>, Json(payload): Json<Product>) -> impl IntoResponse {
    let result = sqlx::query(
        "INSERT INTO products (barcode, name, brand, image_url, nutriscore, ecoscore, ingredients_text, additives_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
    )
    .bind(&payload.barcode).bind(&payload.name).bind(&payload.brand).bind(&payload.image_url)
    .bind(&payload.nutriscore).bind(&payload.ecoscore).bind(&payload.ingredients_text).bind(&payload.additives_count)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => (StatusCode::CREATED, Json(json!({ "status": "ok", "message": "Product created" }))).into_response(),
        Err(_) => (StatusCode::BAD_REQUEST, Json(json!({ "status": "error", "message": "Error creating product" }))).into_response(),
    }
}

async fn get_products(_admin: AdminClaims, State(state): State<AppState>, Query(params): Query<Pagination>) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(10).clamp(1, 100);
    let page = params.page.unwrap_or(1).max(1);
    let offset = (page - 1) * limit;

    let products = sqlx::query_as::<_, Product>("SELECT barcode, name, brand, image_url, nutriscore, ecoscore, ingredients_text, additives_count FROM products LIMIT $1 OFFSET $2")
        .bind(limit).bind(offset)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    Json(json!({ "status": "ok", "products": products })).into_response()
}

async fn delete_product(_admin: AdminClaims, Path(barcode): Path<String>, State(state): State<AppState>) -> impl IntoResponse {
    let result = sqlx::query("DELETE FROM products WHERE barcode = $1")
        .bind(barcode)
        .execute(&state.db)
        .await;

    match result {
        Ok(_) => Json(json!({ "status": "ok", "message": "Product deleted" })).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "message": "Error deleting product" }))).into_response(),
    }
}