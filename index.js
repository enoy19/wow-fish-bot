const screenshot = require("screenshot-desktop");
const PNG = require("pngjs").PNG;
const fs = require("fs");
const robot = require("robotjs");

const xOffset = 500;
const yOffset = 580;
const width = 1100;
const height = 370;
const fishingArea = {
  xOffset,
  yOffset,
  width,
  height,
};
const redFeatherColor = 0x110c07;
const splashColor = 0x64989e;
const splashColorThreshold = 3;
const splashColorFuzzyMatchPercantage = 0.1;

function fuzzyColorMatch(color, otherColor, fuzzyMatchPercentage) {
  const r1 = (color >> 16) & 0xff;
  const g1 = (color >> 8) & 0xff;
  const b1 = color & 0xff;
  const r2 = (otherColor >> 16) & 0xff;
  const g2 = (otherColor >> 8) & 0xff;
  const b2 = otherColor & 0xff;

  return (
    fuzzyMatch(r1, r2, fuzzyMatchPercentage) &&
    fuzzyMatch(g1, g2, fuzzyMatchPercentage) &&
    fuzzyMatch(b1, b2, fuzzyMatchPercentage)
  );
}

function fuzzyMatch(val, otherVal, fuzzyMatchPercentage) {
  const valMinus = val - val * fuzzyMatchPercentage;
  const valPlus = val + val * fuzzyMatchPercentage;
  return otherVal >= valMinus && otherVal <= valPlus;
}

async function getScreenshot(
  { xOffset, yOffset, width, height },
  fileDestination
) {
  const img = await screenshot({ format: "png" });

  const png = PNG.sync.read(img);
  const dst = new PNG({ width, height });

  PNG.bitblt(png, dst, xOffset, yOffset, width, height);

  if (fileDestination) {
    dst.pack().pipe(fs.createWriteStream(fileDestination));
  }

  return dst;
}

async function countColor(
  searchColor,
  fuzzyMatchPercantage,
  { xOffset, yOffset, width, height }
) {
  const screenshot = await getScreenshot({ xOffset, yOffset, width, height });

  let counter = 0;
  for (var y = 0; y < screenshot.height; y++) {
    for (var x = 0; x < screenshot.width; x++) {
      var index = (screenshot.width * y + x) << 2;

      const r = screenshot.data[index];
      const g = screenshot.data[index + 1];
      const b = screenshot.data[index + 2];
      let color = 0;
      color += r;
      color = color << 8;
      color += g;
      color = color << 8;
      color += b;
      if (fuzzyColorMatch(searchColor, color, fuzzyMatchPercantage)) {
        counter++;
      }
    }
  }

  return counter;
}

async function findColor(searchColor, { xOffset, yOffset, width, height }) {
  const screenshot = await getScreenshot({ xOffset, yOffset, width, height });

  for (var y = 0; y < screenshot.height; y++) {
    for (var x = 0; x < screenshot.width; x++) {
      var index = (screenshot.width * y + x) << 2;

      const r = screenshot.data[index];
      const g = screenshot.data[index + 1];
      const b = screenshot.data[index + 2];
      let color = 0;
      color += r;
      color = color << 8;
      color += g;
      color = color << 8;
      color += b;
      if (color === searchColor) {
        return {
          x: x + xOffset,
          y: y + yOffset,
        };
      }
    }
  }

  return null;
}

async function thresholdColor(
  searchColor,
  threshold,
  fuzzyMatchPercantage,
  { xOffset, yOffset, width, height },
  timeOutMillis
) {
  let timePast = 0;
  let prevTime = Date.now();
  while (timePast < timeOutMillis) {
    const colorCount = await countColor(searchColor, fuzzyMatchPercantage, {
      xOffset,
      yOffset,
      width,
      height,
    });
    if (colorCount >= threshold) {
      return true;
    }

    const currentTime = Date.now();
    timePast += currentTime - prevTime;
    prevTime = currentTime;
  }

  return false;
}

async function searchColor(
  searchColor,
  { xOffset, yOffset, width, height },
  timeOutMillis
) {
  let timePast = 0;
  let prevTime = Date.now();
  while (timePast < timeOutMillis) {
    const colorPosition = await findColor(searchColor, {
      xOffset,
      yOffset,
      width,
      height,
    });
    if (colorPosition) {
      return colorPosition;
    }

    const currentTime = Date.now();
    timePast += currentTime - prevTime;
    prevTime = currentTime;
  }

  return null;
}

async function wait(timeOutMillis) {
    return new Promise((resolve) => setTimeout(resolve, timeOutMillis));
}

async function main() {
  await getScreenshot(fishingArea, "./fishingArea.png");
  console.log('waiting...');
  await wait(3 * 1000);
  console.log('start');
  while (true) {
    robot.keyTap('0');
    const featherPosition = await searchColor(
      redFeatherColor,
      fishingArea,
      20 * 1000
    );
    if (featherPosition) {
      console.log(featherPosition);
      const fishingFloatArea = {
        xOffset: featherPosition.x - 60,
        yOffset: featherPosition.y - 35,
        width: 100,
        height: 100,
      };
      const colorThresholdReached = await thresholdColor(
        splashColor,
        splashColorThreshold,
        splashColorFuzzyMatchPercantage,
        fishingFloatArea,
        20 * 1000
      );

      if (colorThresholdReached) {
        console.log("splash detected");
        robot.moveMouse(featherPosition.x, featherPosition.y);
        robot.keyToggle('shift', 'down');
        await wait(150 + (Math.random() * 150));
        robot.mouseClick('right');
        await wait(200);
        robot.keyToggle('shift', 'up');
        console.log('fish caught');
        await wait(5 * 1000);
        robot.moveMouse(0, 0);
      }
    } else {
      console.log("feather not found, no fish caught");
    }
  }
}

main();
