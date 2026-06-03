const fs = require('fs');
const path = require('path');

/**
 * ODC Whitelabel Build Hook
 * This script runs during MABS build after the native project is prepared.
 * It detects the App ID and injects Brand Name, Icons, and Colors.
 */

// 1. Get configuration from ODC Extensibility Configuration (Preferences)
// In ODC, these are passed as environment variables to the build process.
const WHITELABEL_MAP_STR = process.env.WHITELABEL_MAP || "{}";
let WHITELABEL_MAP = {};

try {
    WHITELABEL_MAP = JSON.parse(WHITELABEL_MAP_STR);
} catch (e) {
    console.error("Whitelabel Plugin: FATAL - Could not parse WHITELABEL_MAP. Ensure it is a valid JSON string.");
    process.exit(0); // Exit gracefully so the build doesn't fail, but log the error
}

function applyBranding() {
    const projectRoot = process.cwd();
    
    // 2. Detect the current App ID (which was set by the Python script via API)
    const capConfigPath = path.join(projectRoot, 'capacitor.config.json');
    if (!fs.existsSync(capConfigPath)) {
        console.error("Whitelabel Plugin: capacitor.config.json not found at " + capConfigPath);
        return;
    }

    const capConfig = JSON.parse(fs.readFileSync(capConfigPath, 'utf8'));
    const currentAppId = capConfig.appId;
    const brand = WHITELABEL_MAP[currentAppId];

    if (!brand) {
        console.log(`Whitelabel Plugin: No branding mapping found for App ID [${currentAppId}]. Skipping custom logic.`);
        return;
    }

    console.log(`\n=========================================`);
    console.log(`WHITELABEL PLUGIN: APPLYING BRAND [${brand.name}]`);
    console.log(`App ID: ${currentAppId}`);
    console.log(`=========================================\n`);

    // --- A. UPDATE APP NAME ---
    updateAndroidName(projectRoot, brand.name);
    updateIosName(projectRoot, brand.name);

    // --- B. UPDATE COLORS ---
    if (brand.primaryColor) {
        updateAndroidColors(projectRoot, brand.primaryColor);
        updateIosColors(projectRoot, brand.primaryColor);
    }

    // --- C. UPDATE ICONS ---
    // We look for icons in the plugin's 'brands' folder matching the App ID
    const pluginPath = __dirname; // This script is in scripts/
    const brandAssetsPath = path.join(pluginPath, '..', 'brands', currentAppId);
    
    if (fs.existsSync(brandAssetsPath)) {
        console.log(`Whitelabel Plugin: Found asset folder for ${currentAppId}. Copying icons...`);
        copyAndroidIcons(projectRoot, brandAssetsPath);
        copyIosIcons(projectRoot, brandAssetsPath);
    } else {
        console.log(`Whitelabel Plugin: No asset folder found at ${brandAssetsPath}. Icons will not be updated.`);
    }
}

function updateAndroidName(root, name) {
    const stringsPath = path.join(root, 'android/app/src/main/res/values/strings.xml');
    if (fs.existsSync(stringsPath)) {
        let content = fs.readFileSync(stringsPath, 'utf8');
        content = content.replace(/<string name="app_name">.*?<\/string>/, `<string name="app_name">${name}</string>`);
        content = content.replace(/<string name="title_activity_main">.*?<\/string>/, `<string name="title_activity_main">${name}</string>`);
        fs.writeFileSync(stringsPath, content);
        console.log("Whitelabel Plugin: Updated Android strings.xml");
    }
}

function updateIosName(root, name) {
    const plistPath = path.join(root, 'ios/App/App/Info.plist');
    if (fs.existsSync(plistPath)) {
        let content = fs.readFileSync(plistPath, 'utf8');
        content = content.replace(/<key>CFBundleDisplayName<\/key>\s*<string>.*?<\/string>/, `<key>CFBundleDisplayName</key>\n\t<string>${name}</string>`);
        content = content.replace(/<key>CFBundleName<\/key>\s*<string>.*?<\/string>/, `<key>CFBundleName</key>\n\t<string>${name}</string>`);
        fs.writeFileSync(plistPath, content);
        console.log("Whitelabel Plugin: Updated iOS Info.plist");
    }
}

function updateAndroidColors(root, hexColor) {
    const colorsPath = path.join(root, 'android/app/src/main/res/values/colors.xml');
    // If colors.xml doesn't exist, we create a basic one
    let content = "";
    if (fs.existsSync(colorsPath)) {
        content = fs.readFileSync(colorsPath, 'utf8');
        if (content.includes('name="colorPrimary"')) {
            content = content.replace(/<color name="colorPrimary">.*?<\/color>/, `<color name="colorPrimary">${hexColor}</color>`);
        } else {
            content = content.replace('</resources>', `    <color name="colorPrimary">${hexColor}</color>\n</resources>`);
        }
    } else {
        content = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="colorPrimary">${hexColor}</color>\n</resources>`;
    }
    fs.writeFileSync(colorsPath, content);
    console.log("Whitelabel Plugin: Updated Android colors.xml with " + hexColor);
}

function updateIosColors(root, hexColor) {
    // For iOS/Capacitor, colors are often managed via the Assets.xcassets or Styles.
    // As a simple PoC, we'll log it. Full implementation would modify Contents.json of a color set.
    console.log("Whitelabel Plugin: iOS primary color update is ready for expansion (requires Assets.xcassets manipulation).");
}

function copyAndroidIcons(root, brandPath) {
    // Expected files in brandPath: icon.png
    const sourceIcon = path.join(brandPath, 'icon.png');
    if (!fs.existsSync(sourceIcon)) return;

    // List of densities to replace
    const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
    densities.forEach(d => {
        const targetPath = path.join(root, `android/app/src/main/res/mipmap-${d}/ic_launcher.png`);
        if (fs.existsSync(path.dirname(targetPath))) {
            fs.copyFileSync(sourceIcon, targetPath);
            // Also replace the round icon if it exists
            const roundTarget = targetPath.replace('ic_launcher.png', 'ic_launcher_round.png');
            fs.copyFileSync(sourceIcon, roundTarget);
        }
    });
    console.log("Whitelabel Plugin: Android launcher icons replaced.");
}

function copyIosIcons(root, brandPath) {
    // Expected file: AppIcon.appiconset (folder) or individual PNGs
    console.log("Whitelabel Plugin: iOS icon replacement is ready for expansion.");
}

applyBranding();
