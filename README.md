# Kayu — Eco-friendly Scanner

A web application that scans product barcodes and evaluates their **nutritional quality**, **food processing level**, and **environmental impact** — helping you make healthier and greener choices at a glance.

> **Stack**: Rust backend · HTML · CSS · JavaScript

---

## Live Demo

[kayu.app](https://kayu.silvernight-luther.workers.dev/) *(accessible now)*

---

## Features

- Scan product barcodes via webcam 
- View **Nutri-Score** — nutritional quality grade (A–E)
- View **NOVA** classification — food processing level (1–4)
- View **Eco-Score** — environmental impact grade (A–E)
- Copy or share scan results

---

## Scoring Indexes

Kayu uses three independent, scientifically-grounded indexes to evaluate each product.

###  Nutri-Score

A French 5-color nutrition label now adopted worldwide. Products are graded **A** (best, green) to **E** (worst, red) based on their category.

- **Promotes** a better score: fruits, vegetables, fiber, protein
- **Lowers** the score: high energy, sugar, saturated fat

###  NOVA

A Brazilian food classification system based on the **degree of processing**:

| Grade | Description |
|-------|-------------|
| 1 | Unprocessed or minimally processed foods |
| 2 | Processed culinary ingredients |
| 3 | Processed foods |
| 4 | Ultra-processed foods |

### Eco-Score (Green-Score)

Similar letter grading (A–E) focused on **ecological footprint**. Factors include:

- Water use
- Land use
- Packaging
- Country of origin
- Transport emissions

---

## Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- A modern Chromium-based browser (for best Barcode Detection API support)
- **[nvm](https://github.com/nvm-sh/nvm)** (Node Version Manager)

### Installation

```sh
git clone https://github.com/SilverBtc/Kayu.git
cd Kayu
```

### Running the backend

```sh
cargo run
```

The server will start at `http://localhost:8080` by default.

### Frontend

Open `index.html` in your browser, or serve it with any static file server:

```sh
npx serve .
//or 
npm install
//if not working try
// go in the folder /frontend
npm i
npm start
```

---

## Browser Compatibility

The [Barcode Detection API](https://developer.mozilla.org/docs/Web/API/Barcode_Detection_API) is natively supported on **Chromium browsers on macOS and Android**. A polyfill is used automatically for other browsers.

Can be accessed either on phone or laptop 

We recommand iphone for better user experiences

---

## FAQ

**Which indexes do you use to evaluate products?**  
We use three complementary indexes: Nutri-Score (nutrition), NOVA (processing), and Eco-Score (environment). See the [Scoring Indexes](#scoring-indexes) section above for full details.

**Why don't I see all three scores for every product?**  
Score availability depends on the data provided by the product's manufacturer and the open food database. Some products may have incomplete data.

**Is my scan history stored on your servers?**  
No. Scan history is stored entirely in your browser's local IndexedDB. Nothing is sent to any server.

**Which barcode formats are supported?**  
QR codes, EAN-13, EAN-8, UPC-A, UPC-E, Code 128, and more — all formats supported by the Barcode Detection API.

---

## Project Structure

```
Kayu/
├── src/           # Rust backend source
├── static/        # HTML, CSS, JS frontend
│   ├── index.html
│   ├── style.css
│   └── app.js
├── Cargo.toml
└── README.md
```

---

## Contributing

Pull requests are welcome if you want to be part of the team! For major changes, please open an issue first to discuss what you'd like to change and implement to our projects

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

We will get back to you and maybe merge the branch.

---

## License

[MIT License](LICENSE)