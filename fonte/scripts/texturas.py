"""Texturas do globo a partir de dados da NASA (domínio público).

Entrada (baixar uma vez para fonte/nasa/, fora do git):
  world.topo.200407.3x5400x2700.jpg   Blue Marble Next Generation, julho de 2004
    https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74393/world.topo.200407.3x5400x2700.jpg
  gebco_08_rev_elev_21600x10800.png   relevo GEBCO 2008 (NASA Visible Earth)
    https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73934/gebco_08_rev_elev_21600x10800.png
  gebco_08_rev_bath_21600x10800.png   batimetria GEBCO 2008 (só para separar terra e mar)
    https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73963/gebco_08_rev_bath_21600x10800.png

Saída (public/textures/):
  terra-cor-<w>.webp     cor: continentes em cinza quente, oceano grafite (já no tom do site)
  terra-relevo-<w>.webp  R,G = normal do relevo (leste, norte), B = máscara de água

uso: python fonte/scripts/texturas.py  (da raiz do projeto)
"""
import os
import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None
# caminhos a partir da raiz do projeto (de onde o script é rodado)
RAIZ = os.getcwd()
NASA = os.path.join(RAIZ, 'fonte', 'nasa')
SAIDA = os.path.join(RAIZ, 'public', 'textures')
os.makedirs(SAIDA, exist_ok=True)

# paleta (sRGB): continente escuro, continente claro, gelo, oceano
TERRA_ESCURA = np.array([0x4e, 0x4a, 0x46], float)
TERRA_CLARA = np.array([0xb4, 0xae, 0xa6], float)
GELO = np.array([0xc8, 0xc2, 0xba], float)
OCEANO = np.array([0x1a, 0x18, 0x17], float)


def carregar(w):
    h = w // 2
    cor = Image.open(os.path.join(NASA, 'world.topo.200407.3x5400x2700.jpg')).convert('RGB')
    cor = np.asarray(cor.resize((w, h), Image.LANCZOS), float)
    rel = Image.open(os.path.join(NASA, 'gebco_08_rev_elev_21600x10800.png')).convert('L')
    rel = rel.resize((w, h), Image.BOX)
    bat = Image.open(os.path.join(NASA, 'gebco_08_rev_bath_21600x10800.png')).convert('L')
    bat = np.asarray(bat.resize((w, h), Image.BOX), float)
    return cor, rel, bat


def mascara_agua(cor, rel, bat):
    # batimetria "rev": terra = 255, mar raso ~252-254, fundo mais escuro.
    # Mar raso que a batimetria marca como 255 (mar do Norte) sai pela cor: relevo zero e azul.
    r, g, b = cor[..., 0], cor[..., 1], cor[..., 2]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    agua = (bat < 254.5) | ((np.asarray(rel, float) < 0.5) & (b > r + 2))
    m = Image.fromarray((agua * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    return np.asarray(m, float) / 255.0, lum


def textura_cor(cor, agua, lum, w):
    terra = 1.0 - agua
    # luminância só da terra, normalizada pelos percentis da própria terra
    lt = lum[terra > 0.5]
    p2, p98 = np.percentile(lt, 2), np.percentile(lt, 98)
    t = np.clip((lum - p2) / (p98 - p2), 0, 1) ** 0.85
    base = TERRA_ESCURA + (TERRA_CLARA - TERRA_ESCURA) * t[..., None]
    # neve e gelo: muito claros e pouco saturados
    r, g, b = cor[..., 0], cor[..., 1], cor[..., 2]
    sat = (np.max(cor, -1) - np.min(cor, -1)) / (np.max(cor, -1) + 1)
    gelo = np.clip((lum - 170) / 50, 0, 1) * np.clip((0.35 - sat) / 0.25, 0, 1)
    base = base + (GELO - base) * gelo[..., None]
    # oceano liso, um pouco mais claro perto da costa (plataforma)
    costa = np.asarray(Image.fromarray((terra * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(w / 900)), float) / 255
    oceano = OCEANO + np.array([6, 5, 5], float) * np.clip(costa * 2.2, 0, 1)[..., None]
    out = base * terra[..., None] + oceano * agua[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def textura_relevo(rel, agua, w, forca):
    h = w // 2
    alt = np.asarray(rel.filter(ImageFilter.GaussianBlur(w / 4096 * 1.1)), float) / 252.0
    # declividade em pixels; leste corrigido pela latitude (meridianos se fecham nos polos)
    dx = (np.roll(alt, -1, 1) - np.roll(alt, 1, 1)) * 0.5
    dy = np.zeros_like(alt)
    dy[1:-1] = (alt[2:] - alt[:-2]) * 0.5
    lat = (0.5 - (np.arange(h) + 0.5) / h) * np.pi
    coslat = np.clip(np.cos(lat), 0.12, 1)[:, None]
    escala = forca * (w / 4096)
    nx = -dx / coslat * escala
    ny = dy * escala  # imagem cresce para o sul; norte = -dy da imagem, sinal invertido duas vezes
    nz = np.ones_like(alt)
    n = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx, ny = nx / n, ny / n
    rgb = np.stack([(nx * 0.5 + 0.5) * 255, (ny * 0.5 + 0.5) * 255, agua * 255], -1)
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))


for w, q in ((4096, 88), (2048, 86)):
    cor, rel, bat = carregar(w)
    agua, lum = mascara_agua(cor, rel, bat)
    textura_cor(cor, agua, lum, w).save(os.path.join(SAIDA, f'terra-cor-{w}.webp'), quality=q, method=6)
    textura_relevo(rel, agua, w, forca=36).save(os.path.join(SAIDA, f'terra-relevo-{w}.webp'), quality=94, method=6)
    print('ok', w)
