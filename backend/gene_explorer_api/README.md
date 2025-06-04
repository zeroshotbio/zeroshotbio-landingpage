The directory backend/gene_explorer_api contains the self-contained Flask service that powers both Gene-Explorer 1.0 and Gene-Explorer Perturbation. The code is identical to what runs on the GPU-backed EC2 instance behind https://perturb.zeroshot.bio, allowing anyone who clones the repository to review, reproduce, or extend the back-end without needing SSH access to the production server.

The heart of the service is app.py. When the program starts it loads a compact Transformer model called tsGPT v2.0.7 With Attention, restores its weights from final_model.h5, and then exposes three routes. The health route at /health merely returns a short JSON payload confirming that the server is alive. The core route at /api/analyze expects a small JSON document specifying a gene symbol together with optional context (developmental stage, anatomy, and time point). The handler converts that request into a synthetic input tensor, performs a forward pass through the model while capturing its multi-head attention maps, and then distils those maps into a miniature gene–gene network. The network is serialised as a list of nodes and edges, ready for immediate consumption by the Vis-Network component inside the Next.js front-end. A third, convenience route at /api/get_gene_name/<token_id> translates numeric token identifiers back into human-readable gene symbols.

Two small JSON files accompany the code. combined_processed_207_gene2idx.json provides a deterministic mapping between roughly two thousand zebrafish gene names and the integer token IDs used by the model, while gene_names.json presents the same vocabulary in plain-list form for the front-end’s autocomplete widget. Both of these files are lightweight and therefore live in Git. By contrast, the weight file final_model.h5 is over a hundred megabytes and is not tracked by Git. The repository therefore outsources the binary either to Git LFS or to an external object store such as S3 or Hugging Face. When you launch the server locally you can pass --weights_file path/to/final_model.h5; if the file is absent the helper code will download it automatically from the URL defined near the top of app.py.

The service depends on a small Python stack: Flask 3.1, Flask-CORS 5.0, TensorFlow 2.15, and NumPy 1.26. These requirements are pinned in requirements.txt so that pip install -r requirements.txt recreates the exact runtime that the production instance uses. If you prefer containers you may run docker build -t zeroshot-backend backend/gene_explorer_api followed by docker run -p 5001:5001 zeroshot-backend; the provided Dockerfile reproduces the same environment inside a slim Debian image.

To run the service natively you can create a virtual environment, install the requirements, and launch the server like so:

bash
Copy
Edit
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py \
  --weights_file final_model.h5 \
  --mapping_json combined_processed_207_gene2idx.json \
  --initial_gene klf3 \
  --timepoint 2dpf \
  --dev_stage larval-5dpf \
  --anatomy hematopoietic_system \
  --port 5001
Once the server prints “Starting Flask server on port 5001 …” you can confirm that everything is working by visiting http://localhost:5001/health or by issuing a short test curl command:

bash
Copy
Edit
curl -X POST http://localhost:5001/api/analyze \
     -H 'Content-Type: application/json' \
     -d '{"gene_name":"klf3","dev_stage":"larval-5dpf","anatomy":"neural_crest"}'
The response is a JSON blob whose nodes, edges, and summary fields mirror the structure consumed by the React visualiser.

Because the Flask process is stateless and because all configuration options are exposed as command-line flags, the same container or Python environment can be reused for local debugging, automated tests, or cloud deployment. The production EC2 host starts the service with a standard nohup command wrapped inside a systemd unit; developers are free to adopt any other process manager.

Finally, note that every inference request is entirely CPU-bound unless you supply a GPU-visible TensorFlow build. The public instance runs on an NVIDIA-equipped g5 instance, but for day-to-day development a laptop will suffice; a single query on the CPU finishes in well under half a second.