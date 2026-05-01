use axum::{
    extract::{Path, State},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use tower_http::cors::{Any, CorsLayer};
use serde_json::json;
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::sync::Arc;
use dotenv::dotenv;
use reqwest::StatusCode as HttpStatusCode;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool, // handler Supabase
}

#[tokio::main]
async fn main() {
    dotenv().ok();

    let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    
    let pool = match PgPoolOptions::new()
        .max_connections(10)
        .connect(&db_url)
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
        .route("/api/products/{barcode}", get(get_products_by_barcode))
        .route("/api/products/openfoodfacts/{barcode}", get(get_products_by_barcode_from_openfoodfacts))
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


use serde::{Serialize, Deserialize};

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
    State(_state): State<AppState> // Remet _state si tu n'utilises pas la DB ici
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