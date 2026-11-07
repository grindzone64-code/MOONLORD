import os
import subprocess
import shutil
import glob
import sys
from PIL import Image

def build():
    base_dir = r"C:\Users\chint\Downloads\Self__bot-main"
    sub_dir = os.path.join(base_dir, "Self__bot-main")
    apk_source = os.path.join(base_dir, "apk_source")
    apktool_jar = r"C:\Users\chint\aimkill_mod\apktool.jar"
    signer_jar = os.path.join(sub_dir, "uber-apk-signer.jar")
    icon_src = os.path.join(sub_dir, "build", "icon.png")
    dest_downloads = r"C:\Users\chint\Downloads\MOON-LORD.apk"
    local_apk = os.path.join(sub_dir, "MOON-LORD.apk")

    print("[MOON LORD Builder] 0. Packaging fresh verified dashboard assets...")
    try:
        sys.path.insert(0, base_dir)
        import prepare_full_apk_dashboard
        prepare_full_apk_dashboard.build_assets()
    except Exception as e:
        print("[MOON LORD Builder] Warning building assets:", e)

    print("[MOON LORD Builder] Starting robust Android APK compilation via Apktool & AAPT2...")

    # Clean existing temporary build artifacts in base_dir
    for old_file in glob.glob(os.path.join(base_dir, "*.apk")) + glob.glob(os.path.join(base_dir, "*.idsig")):
        try: os.remove(old_file)
        except: pass

    # 1. Update icon mipmaps
    if os.path.exists(icon_src):
        icon = Image.open(icon_src).convert('RGBA')
        sizes = {
            'mipmap-mdpi': 48,
            'mipmap-hdpi': 72,
            'mipmap-xhdpi': 96,
            'mipmap-xxhdpi': 144,
            'mipmap-xxxhdpi': 192
        }
        for folder, sz in sizes.items():
            dirpath = os.path.join(apk_source, 'res', folder)
            os.makedirs(dirpath, exist_ok=True)
            resized = icon.resize((sz, sz), Image.Resampling.LANCZOS)
            resized.save(os.path.join(dirpath, 'ic_launcher.png'), format='PNG')
            resized.save(os.path.join(dirpath, 'ic_launcher_round.png'), format='PNG')
        print("[MOON LORD Builder] Generated all icon resolutions.")

    # 2. Build APK using Apktool
    unsigned_apk = os.path.join(base_dir, "MOON-LORD-unaligned.apk")
    print("[MOON LORD Builder] Building APK package...")
    cmd_build = f'java -jar "{apktool_jar}" b "{apk_source}" -o "{unsigned_apk}"'
    res = subprocess.run(cmd_build, shell=True, capture_output=True, text=True)
    if res.returncode != 0:
        print("[Apktool Error]:", res.stderr)
        return False
    print("[MOON LORD Builder] Built successfully with AAPT2.")

    # 3. Sign and align using uber-apk-signer
    print("[MOON LORD Builder] Signing with v1, v2, v3 schemes and zipaligning...")
    cmd_sign = f'java -jar "{signer_jar}" -a "{unsigned_apk}" --out "{base_dir}" --allowResign'
    res_sign = subprocess.run(cmd_sign, shell=True, capture_output=True, text=True)
    print(res_sign.stdout)

    # 4. Locate signed output and deploy
    signed_candidates = glob.glob(os.path.join(base_dir, "*unaligned-aligned-debugSigned.apk"))
    if not signed_candidates:
        signed_candidates = glob.glob(os.path.join(base_dir, "*aligned-debugSigned.apk"))

    if signed_candidates:
        signed_apk = signed_candidates[0]
        shutil.copyfile(signed_apk, local_apk)
        shutil.copyfile(signed_apk, dest_downloads)
        print(f"[MOON LORD Builder] SUCCESS! Installed to {dest_downloads} and {local_apk}")
        try: os.remove(signed_apk)
        except: pass
        try: os.remove(unsigned_apk)
        except: pass
        return True
    else:
        print("[MOON LORD Builder] Error: Signed APK not found.")
        return False

if __name__ == "__main__":
    build()
