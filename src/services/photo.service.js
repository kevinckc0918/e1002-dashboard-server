import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PHOTO_DIRECTORY = path.join(
  __dirname,
  "..",
  "..",
  "public",
  "photos"
);

const SUPPORTED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
]);

function naturalSort(a, b) {
  return a.localeCompare(b, "en", {
    numeric: true,
    sensitivity: "base"
  });
}

export async function getPhotoList() {
  try {
    const entries = await fs.readdir(
      PHOTO_DIRECTORY,
      {
        withFileTypes: true
      }
    );

    return entries
      .filter((entry) => {
        if (!entry.isFile()) {
          return false;
        }

        const extension = path
          .extname(entry.name)
          .toLowerCase();

        return SUPPORTED_EXTENSIONS.has(extension);
      })
      .map((entry) => ({
        filename: entry.name,
        url: `/photos/${encodeURIComponent(entry.name)}`
      }))
      .sort((a, b) =>
        naturalSort(a.filename, b.filename)
      );
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn(
        "Photo directory does not exist:",
        PHOTO_DIRECTORY
      );

      return [];
    }

    console.error(
      "Unable to scan photo directory:",
      error
    );

    return [];
  }
}

export async function getSelectedPhoto() {
  const photos = await getPhotoList();

  if (photos.length === 0) {
    return null;
  }

  const intervalMinutes = Math.max(
    1,
    Number(process.env.PHOTO_INTERVAL || 30)
  );

  const hongKongTime = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Hong_Kong"
    })
  );

  const minutesSinceMidnight =
    hongKongTime.getHours() * 60 +
    hongKongTime.getMinutes();

  const slot = Math.floor(
    minutesSinceMidnight / intervalMinutes
  );

  const index = slot % photos.length;

  return {
    ...photos[index],
    index,
    total: photos.length,
    intervalMinutes
  };
}