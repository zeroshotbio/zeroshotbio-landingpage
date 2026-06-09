#!/usr/bin/env python3
"""
Timelapse capturer for the daniotype_kasperov AutoPilot run.

Drives a headless Chromium on the EC2 box through the wizard's CAPTURE MODE
(`?capture=1&dataset=<id>&model=<m>`), which auto-runs the in-browser AutoPilot
so the whole 2-3 hour sweep can be filmed. Screenshots the page on an interval
into an EBS folder, then squeezes every frame into one ~60s GIF timelapse.

Run standalone:
  /data/.venv/bin/python capture_gif.py --dataset zscape --model gpt-5-mini \
      --base https://www.zeroshot.bio --out /data/daniotype_runs/gifs/<id>

Writes <out>/frames/frame_NNNNN.png, <out>/timelapse.gif, and <out>/status.json
(progress, polled by the worker / readable by the user).
"""
import argparse, json, os, sys, time, traceback

TARGET_SECONDS = 60.0       # final GIF length
GIF_WIDTH = 900             # downscale width
GIF_COLORS = 96             # palette size per frame
MIN_FRAME_MS = 40           # GIF min sane frame duration
MAX_FRAME_MS = 240
MAX_GIF_FRAMES = 800        # bound the GIF size (a 2-3h run captures ~1000+ frames)


def write_status(out, **kw):
    kw["t"] = int(time.time())
    try:
        with open(os.path.join(out, "status.json"), "w") as f:
            json.dump(kw, f)
    except Exception:
        pass


def assemble_gif(frame_dir, gif_path, status_out):
    from PIL import Image
    frames = sorted(f for f in os.listdir(frame_dir) if f.endswith(".png"))
    if not frames:
        write_status(status_out, phase="error", error="no frames captured")
        return None
    captured = len(frames)
    # bound the GIF: if we filmed more than MAX_GIF_FRAMES, keep an evenly-spaced subset
    if captured > MAX_GIF_FRAMES:
        step = captured / MAX_GIF_FRAMES
        frames = [frames[int(i * step)] for i in range(MAX_GIF_FRAMES)]
    n = len(frames)
    per_ms = int(max(MIN_FRAME_MS, min(MAX_FRAME_MS, round(TARGET_SECONDS * 1000 / n))))
    write_status(status_out, phase="encoding", frames=n, gif=gif_path)
    imgs = []
    for i, name in enumerate(frames):
        try:
            im = Image.open(os.path.join(frame_dir, name)).convert("RGB")
            if im.width > GIF_WIDTH:
                im = im.resize((GIF_WIDTH, round(im.height * GIF_WIDTH / im.width)), Image.LANCZOS)
            imgs.append(im.quantize(colors=GIF_COLORS, method=Image.MEDIANCUT))
        except Exception:
            continue
        if i % 50 == 0:
            write_status(status_out, phase="encoding", frames=n, encoded=i, gif=gif_path)
    if not imgs:
        write_status(status_out, phase="error", error="no decodable frames")
        return None
    imgs[0].save(gif_path, save_all=True, append_images=imgs[1:], duration=per_ms, loop=0, optimize=True, disposal=2)
    size_mb = round(os.path.getsize(gif_path) / 1e6, 1)
    write_status(status_out, phase="done", frames=n, fps=round(1000 / per_ms, 1), gif=gif_path, size_mb=size_mb)
    return gif_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--base", default="https://www.zeroshot.bio")
    ap.add_argument("--out", required=True)
    ap.add_argument("--interval", type=float, default=10.0)   # seconds between frames
    ap.add_argument("--max-hours", type=float, default=5.0)
    ap.add_argument("--width", type=int, default=1600)
    ap.add_argument("--height", type=int, default=900)
    a = ap.parse_args()

    frame_dir = os.path.join(a.out, "frames")
    os.makedirs(frame_dir, exist_ok=True)
    gif_path = os.path.join(a.out, "timelapse.gif")
    url = f"{a.base}/daniotype_kasperov?capture=1&dataset={a.dataset}&model={a.model}"
    write_status(a.out, phase="starting", url=url, dataset=a.dataset, model=a.model)

    from playwright.sync_api import sync_playwright
    deadline = time.time() + a.max_hours * 3600
    frame_i = 0
    done_seen = 0  # capture a few extra frames after "done" before stopping
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb"])
            page = browser.new_page(viewport={"width": a.width, "height": a.height}, device_scale_factor=1)
            page.on("dialog", lambda d: d.dismiss())  # never block on a confirm()
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(2500)
            last_phase, last_done, last_total = "loading", 0, 0
            while time.time() < deadline:
                try:
                    page.screenshot(path=os.path.join(frame_dir, f"frame_{frame_i:05d}.png"))
                    frame_i += 1
                except Exception:
                    pass
                try:
                    st = page.evaluate("() => window.__kasperov || {phase:'loading',done:0,total:0}")
                    last_phase = st.get("phase", last_phase)
                    last_done = st.get("done", last_done)
                    last_total = st.get("total", last_total)
                except Exception:
                    pass
                if frame_i % 5 == 0:
                    write_status(a.out, phase="capturing", run_phase=last_phase, done=last_done, total=last_total, frames=frame_i, gif=gif_path)
                if last_phase == "done":
                    done_seen += 1
                    if done_seen >= 4:   # ~4 trailing frames showing the finished state
                        break
                page.wait_for_timeout(int(a.interval * 1000))
            browser.close()
    except Exception as e:
        write_status(a.out, phase="capture_error", error=str(e)[:300], frames=frame_i, traceback=traceback.format_exc()[-800:])

    return assemble_gif(frame_dir, gif_path, a.out)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.stderr.write("capture_gif fatal: %s\n%s\n" % (e, traceback.format_exc()))
        sys.exit(1)
