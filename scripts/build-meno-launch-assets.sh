#!/usr/bin/env bash
set -euo pipefail

task_root="$(cd "$(dirname "$0")/.." && pwd)"
asset_dir="$task_root/assets/meno-20260801"
morning_src="${1:?morning source image required}"
evening_src="${2:?evening source image required}"

mkdir -p "$asset_dir"

serif="/usr/share/fonts/opentype/urw-base35/P052-Bold.otf"
sans="/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf"
sans_bold="/usr/share/fonts/opentype/urw-base35/NimbusSans-Bold.otf"

convert "$morning_src" -auto-orient -resize '1080x1350^' -gravity center -extent 1080x1350 \
  -fill 'rgba(251,248,244,0.84)' -draw 'rectangle 0,0 655,1350' \
  -gravity northwest \
  -fill '#A77A62' -font "$sans_bold" -pointsize 30 -kerning 5 -annotate +72+98 'COREAXIS  |  MENOPAUSE CORE' \
  -fill '#302A28' -font "$serif" -pointsize 64 -interline-spacing -5 \
  -annotate +72+245 $'IF EVERYTHING\nCHANGED\nTOGETHER,\nWHY ARE YOU\nSTILL BEING\nTOLD TO\nEAT LESS?' \
  -fill '#746761' -font "$sans" -pointsize 29 -kerning 2 -interline-spacing 5 \
  -annotate +72+1040 $'The Pattern Map™ reveals\nwhere your strategy\nshould begin.' \
  -fill '#FFFFFF' -stroke none -draw 'roundrectangle 72,1192 560,1270 28,28' \
  -fill '#D98772' -font "$sans_bold" -pointsize 28 -kerning 2 -annotate +112+1244 '90 SECONDS  ·  LINK IN BIO' \
  -strip -quality 92 "$asset_dir/meno-1000-instagram.jpg"

convert "$evening_src" -auto-orient -resize '1080x1350^' -gravity center -extent 1080x1350 \
  -fill 'rgba(48,42,40,0.76)' -draw 'rectangle 0,0 620,1350' \
  -gravity northwest \
  -fill '#F0CCBC' -font "$sans_bold" -pointsize 30 -kerning 5 -annotate +72+98 'COREAXIS  |  MENOPAUSE CORE' \
  -fill '#FFFFFF' -font "$serif" -pointsize 78 -interline-spacing -6 \
  -annotate +72+310 $'YOUR\nAPPETITE\nCHANGED.\nYOUR\nADVICE\nDIDN’T.' \
  -fill '#F6EFE9' -font "$sans" -pointsize 31 -interline-spacing 5 \
  -annotate +72+1048 $'Appetite may be the lead issue—\nor a downstream signal.' \
  -fill '#D98772' -stroke none -draw 'roundrectangle 72,1185 540,1265 28,28' \
  -fill '#FFFFFF' -font "$sans_bold" -pointsize 25 -kerning 1 -annotate +112+1237 'START THE PATTERN MAP™' \
  -strip -quality 92 "$asset_dir/meno-1800-instagram.jpg"

convert "$evening_src" -auto-orient -resize '1080x1920^' -gravity center -extent 1080x1920 \
  -fill 'rgba(48,42,40,0.63)' -draw 'rectangle 0,0 1080,1920' \
  -fill '#F0CCBC' -font "$sans_bold" -pointsize 30 -kerning 5 -gravity north -annotate +0+120 'COREAXIS  |  MENOPAUSE CORE' \
  -fill '#FFFFFF' -font "$serif" -pointsize 84 -interline-spacing -6 -gravity northwest \
  -annotate +86+430 $'BEFORE YOU\nTRY HARDER,\nFIND OUT\nWHAT CHANGED\nFIRST.' \
  -fill '#F6EFE9' -font "$sans" -pointsize 34 -interline-spacing 7 -gravity northwest \
  -annotate +90+1110 $'Five questions.\nOne clear place to begin.' \
  -fill '#D98772' -stroke none -draw 'roundrectangle 90,1510 990,1640 42,42' \
  -fill '#FFFFFF' -font "$sans_bold" -pointsize 36 -kerning 2 -gravity northwest -annotate +178+1556 'TAP TO TAKE THE 90-SECOND MAP' \
  -fill '#FFFFFF' -font "$sans" -pointsize 26 -gravity south -annotate +0+118 'Educational wellness information · Not medical advice' \
  -strip -quality 92 "$asset_dir/meno-1930-story.jpg"

make_video() {
  local image="$1"
  local output="$2"
  local line1="$3"
  local line2="$4"
  local line3="$5"
  ffmpeg -y -loop 1 -i "$image" \
    -f lavfi -i "aevalsrc=0.018*sin(2*PI*110*t)+0.012*sin(2*PI*220*t):s=44100:d=9" \
    -filter_complex "[0:v]scale=1200:2134,crop=1080:1920,zoompan=z='min(zoom+0.0008,1.08)':d=225:s=1080x1920:fps=25,drawbox=x=0:y=0:w=1080:h=1920:color=0x302A28@0.42:t=fill,drawtext=fontfile=${sans_bold}:text='COREAXIS  |  MENOPAUSE CORE':fontcolor=0xF0CCBC:fontsize=28:x=(w-text_w)/2:y=118:enable='between(t,0,9)',drawtext=fontfile=${serif}:text='${line1}':fontcolor=white:fontsize=76:line_spacing=-4:x=82:y=470:enable='between(t,0,2.6)':alpha='if(lt(t,0.25),t/0.25,if(lt(t,2.25),1,(2.6-t)/0.35))',drawtext=fontfile=${serif}:text='${line2}':fontcolor=white:fontsize=76:line_spacing=-4:x=82:y=470:enable='between(t,2.35,5.7)':alpha='if(lt(t,2.7),(t-2.35)/0.35,if(lt(t,5.35),1,(5.7-t)/0.35))',drawtext=fontfile=${serif}:text='${line3}':fontcolor=white:fontsize=68:line_spacing=-2:x=82:y=470:enable='between(t,5.45,9)',drawbox=x=82:y=1450:w=916:h=112:color=0xD98772@0.95:t=fill:enable='between(t,5.45,9)',drawtext=fontfile=${sans_bold}:text='90-SECOND PATTERN MAP  ·  LINK IN BIO':fontcolor=white:fontsize=30:x=(w-text_w)/2:y=1490:enable='between(t,5.45,9)',format=yuv420p[v];[1:a]afade=t=in:st=0:d=0.5,afade=t=out:st=8:d=1[a]" \
    -map '[v]' -map '[a]' -t 9 -r 25 -c:v libx264 -profile:v high -level 4.1 -crf 18 -preset medium -c:a aac -b:a 128k -movflags +faststart "$output"
}

make_video "$morning_src" "$asset_dir/meno-1000-tiktok.mp4" \
  $'MENOPAUSE NUTRITION\nSHOULD NOT MAKE\nYOUR LIFE SMALLER.' \
  $'“EAT LESS” IS NOT\nA COMPLETE\nSTRATEGY.' \
  $'FIND THE FIRST\nLEVERAGE POINT.'

make_video "$evening_src" "$asset_dir/meno-1800-tiktok.mp4" \
  $'YOUR APPETITE\nCHANGED.' \
  $'YOUR ADVICE\nDIDN’T.' \
  $'LEAD ISSUE—OR\nDOWNSTREAM SIGNAL?'

printf '%s\n' "$asset_dir/meno-1000-instagram.jpg" "$asset_dir/meno-1000-tiktok.mp4" "$asset_dir/meno-1800-instagram.jpg" "$asset_dir/meno-1800-tiktok.mp4" "$asset_dir/meno-1930-story.jpg"
