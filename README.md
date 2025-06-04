# Zeroshot Bio ― Full-Stack Demo Suite

*Next JS 14 · Tailwind CSS · Flask · TensorFlow · AWS EC2 · Vercel*

---

## ✨  What lives in this repo?

| Feature                                             | Folder                               | Stack                                    |
| --------------------------------------------------- | ------------------------------------ | ---------------------------------------- |
| **Marketing + Investor Data Room**                  | `src/app/dataroom`                   | Next JS client components & D3           |
| **Gene-Explorer 1.0** (baseline model)              | `src/app/gene-explorer`              | Next JS (front) → Flask on **port 5000** |
| **Gene-Explorer Perturbation** (experimental model) | `src/app/gene-explorer-perturbation` | Next JS (front) → Flask on **port 5001** |
| **Back-end inference service**                      | `backend/gene_explorer_api`          | Flask + TensorFlow 2.15                  |

Everything is styled with Tailwind and deployed to Vercel; the Flask micro-service runs on a GPU EC2 instance behind **[https://perturb.zeroshot.bio](https://perturb.zeroshot.bio)**.

---

## 🚀  Quick start

```bash
# clone & front-end
git clone https://github.com/zeroshotbio/landingpage.git
cd landingpage
cp .env.local.example .env.local   # set FLASK endpoints
npm install
npm run dev          # http://localhost:3000
```

<details>
<summary><strong>Back-end (optional, local CPU)</strong></summary>

```bash
cd backend/gene_explorer_api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py \
  --weights_file final_model.h5 \
  --mapping_json combined_processed_207_gene2idx.json \
  --port 5001
```

Curl test:

```bash
curl -X POST http://localhost:5001/api/analyze \
     -H 'Content-Type: application/json' \
     -d '{"gene_name":"klf3","dev_stage":"larval-5dpf","anatomy":"neural_crest"}'
```

</details>

---

## 🗂️  Key folder map

```text
zeroshotbio-landingpage/
├─ backend/
│  └─ gene_explorer_api/                 Flask + model
│     ├─ app.py                          REST API & tsGPT v2
│     ├─ gene_names.json                 2 000-gene vocabulary
│     ├─ combined_processed_207_gene2idx.json
│     ├─ requirements.txt
│     └─ README.md                       back-end details
├─ public/
│  └─ images/ …                          logos & assets
├─ src/
│  └─ app/
│     ├─ page.tsx                        marketing landing
│     ├─ layout.tsx
│     ├─ api/
│     │  └─ visitors/route.ts            DynamoDB visit logger
│     ├─ dataroom/                       investor wiki
│     ├─ gene-explorer/
│     │  └─ page.tsx                     front-end v1
│     └─ gene-explorer-perturbation/
│        └─ page.tsx                     front-end v2 (port 5001)
├─ tailwind.config.ts
└─ README.md  ← you are here
```

---

## 🏗️  Architecture

### Front-end

* **Next JS 14 App Router.** Each folder under `src/app` becomes a route (client components for D3 / vis-network; server components for layout & API).
* **Vis-network** renders graphs entirely in the browser; physics & aesthetic sliders manipulate the underlying network options in real time.
* Two environment variables pick the target back-end:

  ```bash
  NEXT_PUBLIC_FLASK_ENDPOINT=http://localhost:5000        # Gene-Explorer 1.0
  NEXT_PUBLIC_FLASK_ENDPOINT_PERT=http://localhost:5001   # Perturbation page
  ```

### Back-end

* **Flask 3.1** with CORS, mounted on `/api/analyze` and `/health`.
* **tsGPT v2.0.7 With Attention** (≈12 M parameters) encodes a synthetic 250-token sequence whose centre token is the target gene; multi-head attention maps are distilled into a small node/edge graph.
* Model weights (`final_model.h5`) are downloaded on first run (not tracked in Git).

### Infra

* **Production front-end** runs on Vercel; pushes to `main` trigger a build.
* **GPU EC2** (g5) hosts the Flask service(s) behind Nginx + Let’s Encrypt:

  * `http://localhost:5000` → **gene\_explorer\_api** (baseline)
  * `https://perturb.zeroshot.bio` → reverse-proxied to port 5001
* Nginx config and SSL renewal handled via **certbot** (see back-end README).

---

## 📝  Docs worth reading

| File                                  | What you’ll learn                                           |
| ------------------------------------- | ----------------------------------------------------------- |
| `backend/gene_explorer_api/README.md` | How to run / test / extend the Flask service                |
| `README_gene_explorer.md`             | Deep dive into the front-end TypeScript component           |
| `src/app/dataroom/docs/…`             | All investor-facing copy, chunked into MDX-like React files |

---

## 🛫  Deploying

```bash
# front-end
npm run build       # Vercel does this automatically on push

# back-end (GPU EC2)
git pull
systemctl restart gene-explorer@perturb.service   # example unit
```

Provide the following secrets in Vercel or your shell:

* `NEXT_PUBLIC_FLASK_ENDPOINT` & `NEXT_PUBLIC_FLASK_ENDPOINT_PERT`
* `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
* `AWS_S3_BUCKET_NAME` (optional visitor logging)

---
