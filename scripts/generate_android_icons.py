import os
import sys
from PIL import Image, ImageDraw

def generate_round_mask(size):
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    return mask

def make_round_image(img):
    size = img.size[0]
    mask = generate_round_mask(size)
    output = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    output.paste(img, (0, 0), mask)
    return output

def make_adaptive_foreground(img, target_size):
    # En un ícono adaptativo de Android, el lienzo mide target_size,
    # y la parte visual importante (primer plano) debe estar centrada
    # y medir aproximadamente el 60-70% del tamaño total para no ser recortada.
    fg_size = int(target_size * 0.65)
    resized_fg = img.resize((fg_size, fg_size), Image.Resampling.LANCZOS)
    
    # Crear un lienzo transparente del tamaño total
    canvas = Image.new('RGBA', (target_size, target_size), (0, 0, 0, 0))
    # Centrar la imagen redimensionada en el lienzo
    offset = (target_size - fg_size) // 2
    canvas.paste(resized_fg, (offset, offset), resized_fg.convert('RGBA') if resized_fg.mode != 'RGBA' else resized_fg)
    return canvas

def main():
    icon_path = os.path.join("public", "app_icon.png")
    if not os.path.exists(icon_path):
        print(f"Error: No se encontró la imagen base en {icon_path}")
        sys.exit(1)
        
    base_img = Image.open(icon_path)
    if base_img.mode != 'RGBA':
        base_img = base_img.convert('RGBA')
        
    res_base = os.path.join("android", "app", "src", "main", "res")
    if not os.path.exists(res_base):
        print(f"Error: Directorio de recursos Android no encontrado en {res_base}")
        sys.exit(1)

    # Definición de tamaños por densidad de pantalla
    # Densidad: (Carpeta, Tamaño de Legacy/Round, Tamaño de Adaptive Foreground)
    densities = [
        ("mipmap-mdpi", 48, 108),
        ("mipmap-hdpi", 72, 162),
        ("mipmap-xhdpi", 96, 216),
        ("mipmap-xxhdpi", 144, 324),
        ("mipmap-xxxhdpi", 192, 432)
    ]
    
    print("Generando íconos de Android...")
    
    for folder, legacy_size, adaptive_size in densities:
        folder_path = os.path.join(res_base, folder)
        os.makedirs(folder_path, exist_ok=True)
        
        # 1. Generar ic_launcher.png (Legacy)
        legacy_img = base_img.resize((legacy_size, legacy_size), Image.Resampling.LANCZOS)
        legacy_img.save(os.path.join(folder_path, "ic_launcher.png"), "PNG")
        
        # 2. Generar ic_launcher_round.png (Legacy Redondo)
        round_img = make_round_image(legacy_img)
        round_img.save(os.path.join(folder_path, "ic_launcher_round.png"), "PNG")
        
        # 3. Generar ic_launcher_foreground.png (Adaptive)
        adaptive_fg = make_adaptive_foreground(base_img, adaptive_size)
        adaptive_fg.save(os.path.join(folder_path, "ic_launcher_foreground.png"), "PNG")
        
        print(f" -> Generados íconos en {folder} ({legacy_size}px / {adaptive_size}px)")
        
    print("¡Listo! Todos los íconos móviles han sido actualizados con el diseño premium.")

if __name__ == "__main__":
    main()
