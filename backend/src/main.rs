use axum::{
    extract::{Path, State},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde_json::json;
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::sync::Arc;
use dotenv::dotenv; 

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

    let app = Router::new()
        .route("/api", get(hello_world))
        .route("/api/products/count", get(get_products_count))
        .route("/api/products/{barcode}", get(get_products_by_barcode))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("Server started successfully at http://0.0.0.0:3000");
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