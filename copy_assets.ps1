# Powershell Script to Copy Generated Cohesive Images to Assets Directory
$assetsDir = Join-Path $PSScriptRoot "public"
$assetsDir = Join-Path $assetsDir "assets"
if (-not (Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Path $assetsDir -Force
}

$images = @(
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\hero_glaze_fashion_1784088496146.png"; Dest = "hero_glass_bg.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_hydro_jacket_1784088508883.png"; Dest = "clothing_hydro_jacket.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_neo_dress_1784088518847.png"; Dest = "clothing_neo_dress.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_chroma_hoodie_1784088530971.png"; Dest = "clothing_chroma_hoodie.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_flow_dress_exact_1784089463479.png"; Dest = "clothing_flow_dress.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_uv_shirt_exact_1784089488205.png"; Dest = "clothing_uv_shirt.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_prism_shirt_exact_1784089504085.png"; Dest = "clothing_prism_shirt.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_aero_shorts_exact_1784089521648.png"; Dest = "clothing_aero_shorts.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_womens_shorts_exact_1784089693977.png"; Dest = "clothing_womens_shorts.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_leggings_exact_1784089711181.png"; Dest = "clothing_leggings.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_golf_polo_exact_1784089727821.png"; Dest = "clothing_golf_polo.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_jeans_exact_1784089744765.png"; Dest = "clothing_jeans.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_velo_windbreaker_1784170617843.png"; Dest = "clothing_velo_windbreaker.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_aero_sports_bra_1784170626976.png"; Dest = "clothing_aero_sports_bra.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_lumina_crop_1784170635559.png"; Dest = "clothing_lumina_crop.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_thermo_pants_1784170644156.png"; Dest = "clothing_thermo_pants.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_palazzo_pants_1784170690514.png"; Dest = "clothing_palazzo_pants.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_ribbed_tank_1784170700084.png"; Dest = "clothing_ribbed_tank.jpg" },
    @{ Src = "C:\Users\rod\.gemini\antigravity-ide\brain\c10d9abe-c16e-49ff-a8f7-0d762e1761af\clothing_tech_tee_1784170709189.png"; Dest = "clothing_tech_tee.jpg" }
)

foreach ($img in $images) {
    if (Test-Path $img.Src) {
        $destPath = Join-Path $assetsDir $img.Dest
        Copy-Item -Path $img.Src -Destination $destPath -Force
        Write-Host "Copied to $destPath"
    } else {
        Write-Warning "Source file not found: $($img.Src)"
    }
}
