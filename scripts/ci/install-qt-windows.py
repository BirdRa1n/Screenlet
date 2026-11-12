"""Instala o kit Qt MinGW direto do repositório online da Qt (uso no CI).

O aqtinstall 3.3 ainda não entende o layout novo do repositório do Qt 6.12+
no Windows (uma pasta por compilador: qt6_6120/qt6_6120_mingw/). Este script
lê o Updates.xml dessa pasta, baixa os pacotes pedidos, confere o SHA-1 e
extrai tudo em <saída>/<versão>/mingw_64.

    python scripts/ci/install-qt-windows.py 6.12.0 C:\\Qt qtmultimedia qtshadertools
"""
import hashlib
import os
import subprocess
import sys
import tempfile
import urllib.request
import xml.etree.ElementTree as ET

REPO = "https://download.qt.io/online/qtsdkrepository/windows_x86/desktop"
ARCH = "win64_mingw"
SKIP = ("qtdoc-",)  # documentação: grande e inútil para compilar


def fetch(url, retries=3):
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                raise
            print(f"  tentativa {attempt + 1} falhou ({e}), repetindo")


def main():
    version, outdir, *modules = sys.argv[1:]
    tag = version.replace(".", "")
    base = f"{REPO}/qt6_{tag}/qt6_{tag}_mingw"
    prefix = os.path.join(outdir, version, "mingw_64")
    os.makedirs(prefix, exist_ok=True)

    root = ET.fromstring(fetch(f"{base}/Updates.xml"))
    packages = {p.findtext("Name"): p for p in root.findall("PackageUpdate")}
    wanted = [f"qt.qt6.{tag}.{ARCH}"] + [f"qt.qt6.{tag}.addons.{m}.{ARCH}" for m in modules]

    with tempfile.TemporaryDirectory() as tmp:
        for name in wanted:
            pkg = packages.get(name)
            if pkg is None:
                sys.exit(f"Pacote não encontrado no Updates.xml: {name}")
            pver = pkg.findtext("Version")
            archives = [a.strip() for a in (pkg.findtext("DownloadableArchives") or "").split(",") if a.strip()]
            for archive in archives:
                if archive.startswith(SKIP):
                    continue
                url = f"{base}/{name}/{pver}{archive}"
                print(f"==> {name}: {archive}")
                data = fetch(url)
                expected = fetch(url + ".sha1").decode().split()[0].strip().lower()
                if hashlib.sha1(data).hexdigest() != expected:
                    sys.exit(f"SHA-1 não confere: {url}")
                path = os.path.join(tmp, archive)
                with open(path, "wb") as f:
                    f.write(data)
                subprocess.run(["7z", "x", "-y", "-bso0", "-bsp0", f"-o{prefix}", path], check=True)
                os.remove(path)

    print(f"Qt {version} instalado em {prefix}")


if __name__ == "__main__":
    main()
