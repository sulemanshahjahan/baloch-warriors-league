#!/usr/bin/env python3
"""
Generate Android app icons and splash screens from logo.png
"""

from PIL import Image, ImageDraw
import os

# Logo path
LOGO_PATH = "public/logo.png"
OUTPUT_DIR = "android/app/src/main/res"

# Android icon sizes
ICON_SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

# Splash screen sizes
SPLASH_SIZES = {
    "drawable-land-mdpi": (320, 240),
    "drawable-land-hdpi": (480, 320),
    "drawable-land-xhdpi": (640, 480),
    "drawable-land-xxhdpi": (960, 640),
    "drawable-land-xxxhdpi": (1280, 960),
    "drawable-port-mdpi": (240, 320),
    "drawable-port-hdpi": (320, 480),
    "drawable-port-xhdpi": (480, 640),
    "drawable-port-xxhdpi": (640, 960),
    "drawable-port-xxxhdpi": (960, 1280),
}

# Background color (dark theme matching your website)
BACKGROUND_COLOR = "#0a0a0a"  # Very dark gray/black
# Accent color for gradient
ACCENT_COLOR = "#dc2626"  # Red accent (matching BWL brand)


def create_gradient_background(width, height):
    """Create a gradient background from dark center to darker edges"""
    img = Image.new('RGB', (width, height), BACKGROUND_COLOR)
    draw = ImageDraw.Draw(img)
    
    # Create a subtle radial gradient effect
    center_x, center_y = width // 2, height // 2
    max_dist = ((center_x ** 2) + (center_y ** 2)) ** 0.5
    
    for y in range(0, height, 2):  # Step by 2 for performance
        for x in range(0, width, 2):
            dist = ((x - center_x) ** 2 + (y - center_y) ** 2) ** 0.5
            ratio = dist / max_dist
            # Darker towards edges
            r = int(10 - ratio * 8)
            g = int(10 - ratio * 8)
            b = int(10 - ratio * 6)
            draw.point((x, y), fill=(max(0, r), max(0, g), max(0, b)))
    
    return img


def generate_app_icons():
    """Generate app icons for all densities"""
    print("Generating app icons...")
    
    logo = Image.open(LOGO_PATH)
    
    for folder, size in ICON_SIZES.items():
        output_path = os.path.join(OUTPUT_DIR, folder)
        os.makedirs(output_path, exist_ok=True)
        
        # Create adaptive icon foreground (logo with padding)
        padding = size // 6
        icon_size = size - (padding * 2)
        
        resized_logo = logo.resize((icon_size, icon_size), Image.LANCZOS)
        
        # Create transparent background
        icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        
        # Paste logo centered
        x = (size - icon_size) // 2
        y = (size - icon_size) // 2
        icon.paste(resized_logo, (x, y), resized_logo if resized_logo.mode == 'RGBA' else None)
        
        # Save as ic_launcher_foreground.png
        icon.save(os.path.join(output_path, "ic_launcher_foreground.png"))
        
        # Create background (solid color for adaptive icon)
        background = Image.new("RGBA", (size, size), BACKGROUND_COLOR)
        background.save(os.path.join(output_path, "ic_launcher_background.png"))
        
        # Also save as regular ic_launcher.png for older devices
        icon.save(os.path.join(output_path, "ic_launcher.png"))
        
        # Create round icon
        icon.save(os.path.join(output_path, "ic_launcher_round.png"))
        
        print(f"  Created {folder} ({size}x{size})")


def generate_splash_screens():
    """Generate splash screens for all densities"""
    print("\nGenerating splash screens...")
    
    logo = Image.open(LOGO_PATH)
    
    for folder, (width, height) in SPLASH_SIZES.items():
        output_path = os.path.join(OUTPUT_DIR, folder)
        os.makedirs(output_path, exist_ok=True)
        
        # Create background
        splash = create_gradient_background(width, height)
        
        # Calculate logo size (30% of smallest dimension)
        min_dim = min(width, height)
        logo_size = int(min_dim * 0.35)
        
        resized_logo = logo.resize((logo_size, logo_size), Image.LANCZOS)
        
        # Center the logo
        x = (width - logo_size) // 2
        y = (height - logo_size) // 2
        
        # Paste logo
        if resized_logo.mode == 'RGBA':
            splash.paste(resized_logo, (x, y), resized_logo)
        else:
            splash.paste(resized_logo, (x, y))
        
        # Save as splash.png
        splash.save(os.path.join(output_path, "splash.png"))
        
        print(f"  Created {folder} ({width}x{height})")


def generate_notification_icon():
    """Generate notification icon"""
    print("\nGenerating notification icon...")
    
    logo = Image.open(LOGO_PATH)
    
    # Notification icons are white on transparent
    size = 96
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    
    # Resize logo to fit
    logo_size = int(size * 0.6)
    resized = logo.resize((logo_size, logo_size), Image.LANCZOS)
    
    # Center
    x = (size - logo_size) // 2
    y = (size - logo_size) // 2
    
    icon.paste(resized, (x, y), resized if resized.mode == 'RGBA' else None)
    
    # Save to drawable
    output_path = os.path.join(OUTPUT_DIR, "drawable")
    os.makedirs(output_path, exist_ok=True)
    icon.save(os.path.join(output_path, "ic_notification.png"))
    
    print("  Created notification icon")


if __name__ == "__main__":
    print("=" * 50)
    print("BWL Android Icon & Splash Generator")
    print("=" * 50)
    
    if not os.path.exists(LOGO_PATH):
        print(f"ERROR: Logo not found at {LOGO_PATH}")
        exit(1)
    
    generate_app_icons()
    generate_splash_screens()
    generate_notification_icon()
    
    print("\n" + "=" * 50)
    print("All resources generated successfully!")
    print("=" * 50)
