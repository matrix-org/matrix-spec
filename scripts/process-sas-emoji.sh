#!/bin/bash
#
# Add white circles to the background of each SVG image in sas-emoji, and
# render PNG versions of the images.
#
# Requires:
# * sed
# * inkscape
# * pngquant
#
# Usage:
#
# ./scripts/process-sas-emoji.sh
#

set -e
set -u

START_TAG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">'
REPLA_TAG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 56 56">'
CIRCLE='<circle fill="#FFFFFF" cx="18.0" cy="18.0" r="28.0"/>'

cd data-definitions
mkdir -p sas-emoji

echo -n "Updating SVGs ... "
cd sas-emoji-originals
for SVG in *.svg ; do
    sed "s~${START_TAG}~${REPLA_TAG}${CIRCLE}~" "${SVG}" > "../sas-emoji/${SVG}"
done
echo "done"


echo -n "Rendering PNGs ... "
cd ../sas-emoji
for SVG in *.svg ; do
    PNG_LARGE="${SVG%.svg}-large.png"
    inkscape "${SVG}" "--export-filename=${PNG_LARGE}" --export-width=112
done
echo "done"


cd ../sas-emoji
echo -n "Shrinking PNGs ... "
for PNG_LARGE in *-large.png ; do
    PNG="${PNG_LARGE%-large.png}.png"
    pngquant --speed=1 "${PNG_LARGE}" "--output=${PNG}" --force
    rm "${PNG_LARGE}"
done
echo "done"

cd ..
cp sas-emoji-originals/CREDITS sas-emoji/
cp sas-emoji-originals/LICENSE sas-emoji/
