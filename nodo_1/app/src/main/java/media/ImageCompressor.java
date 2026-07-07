package media;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Build;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

public class ImageCompressor {

    private static final int MAX_SIZE_BYTES = 500 * 1024; // 500KB
    private static final int MAX_DIMENSION = 1280;

    public static byte[] compress(Context context, Uri uri, int maxSizeBytes) {
        try {
            InputStream input = context.getContentResolver().openInputStream(uri);
            if (input == null) return null;

            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inJustDecodeBounds = true;
            BitmapFactory.decodeStream(input, null, opts);
            input.close();

            opts.inSampleSize = calculateInSampleSize(opts, MAX_DIMENSION, MAX_DIMENSION);
            opts.inJustDecodeBounds = false;

            input = context.getContentResolver().openInputStream(uri);
            if (input == null) return null;
            Bitmap bitmap = BitmapFactory.decodeStream(input, null, opts);
            input.close();
            if (bitmap == null) return null;

            bitmap = scaleDown(bitmap, MAX_DIMENSION);

            Bitmap.CompressFormat format;
            if (Build.VERSION.SDK_INT >= 30) {
                format = Bitmap.CompressFormat.WEBP_LOSSY;
            } else {
                format = Bitmap.CompressFormat.JPEG;
            }

            int quality = 90;
            byte[] result;
            do {
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                bitmap.compress(format, quality, baos);
                result = baos.toByteArray();
                quality -= 10;
            } while (result.length > maxSizeBytes && quality > 10);

            if (result.length > maxSizeBytes) {
                return compressFallbackWithLimit(bitmap, maxSizeBytes);
            }

            bitmap.recycle();
            return result;
        } catch (Exception e) {
            return null;
        }
    }

    private static byte[] compressFallbackWithLimit(Bitmap bitmap, int maxSizeBytes) {
        try {
            int maxAttempts = 10;
            int quality = 80;
            byte[] result;
            do {
                if (bitmap.getWidth() > 320 || bitmap.getHeight() > 320) {
                    Bitmap scaled = Bitmap.createScaledBitmap(bitmap,
                            bitmap.getWidth() / 2, bitmap.getHeight() / 2, true);
                    if (scaled != bitmap) bitmap.recycle();
                    bitmap = scaled;
                }
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.JPEG, quality, baos);
                result = baos.toByteArray();
                quality -= 5;
                maxAttempts--;
            } while (result.length > maxSizeBytes && maxAttempts > 0 && quality > 10);

            bitmap.recycle();
            return result;
        } catch (Exception e) {
            return null;
        }
    }

    public static byte[] compress(String filePath) {
        try {
            int rotation = getRotation(filePath);

            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(filePath, options);

            options.inSampleSize = calculateInSampleSize(options, MAX_DIMENSION, MAX_DIMENSION);
            options.inJustDecodeBounds = false;

            Bitmap bitmap = BitmapFactory.decodeFile(filePath, options);
            if (bitmap == null) return null;

            if (rotation != 0) {
                Matrix matrix = new Matrix();
                matrix.postRotate(rotation);
                Bitmap rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
                if (rotated != bitmap) bitmap.recycle();
                bitmap = rotated;
            }

            bitmap = scaleDown(bitmap, MAX_DIMENSION);

            Bitmap.CompressFormat format;
            if (Build.VERSION.SDK_INT >= 30) {
                format = Bitmap.CompressFormat.WEBP_LOSSY;
            } else {
                format = Bitmap.CompressFormat.JPEG;
            }

            int quality = 90;
            byte[] result;
            do {
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                bitmap.compress(format, quality, baos);
                result = baos.toByteArray();
                quality -= 10;
            } while (result.length > MAX_SIZE_BYTES && quality > 10);

            if (result.length > MAX_SIZE_BYTES) {
                return compressFallback(bitmap);
            }

            bitmap.recycle();
            return result;
        } catch (Exception e) {
            return compressFallbackFromFile(filePath);
        }
    }

    private static byte[] compressFallbackFromFile(String filePath) {
        try {
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = 2;
            Bitmap bitmap = BitmapFactory.decodeFile(filePath, options);
            if (bitmap == null) return null;
            return compressFallback(bitmap);
        } catch (Exception e) {
            return null;
        }
    }

    private static byte[] compressFallback(Bitmap bitmap) {
        try {
            int maxAttempts = 10;
            int quality = 80;
            byte[] result;
            do {
                if (bitmap.getWidth() > 320 || bitmap.getHeight() > 320) {
                    Bitmap scaled = Bitmap.createScaledBitmap(bitmap,
                            bitmap.getWidth() / 2, bitmap.getHeight() / 2, true);
                    if (scaled != bitmap) bitmap.recycle();
                    bitmap = scaled;
                }
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.JPEG, quality, baos);
                result = baos.toByteArray();
                quality -= 5;
                maxAttempts--;
            } while (result.length > MAX_SIZE_BYTES && maxAttempts > 0 && quality > 10);

            bitmap.recycle();
            return result;
        } catch (Exception e) {
            return null;
        }
    }

    private static Bitmap scaleDown(Bitmap bitmap, int maxDimension) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        if (width <= maxDimension && height <= maxDimension) return bitmap;
        float ratio = Math.min((float) maxDimension / width, (float) maxDimension / height);
        int newWidth = Math.round(width * ratio);
        int newHeight = Math.round(height * ratio);
        Bitmap scaled = Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true);
        if (scaled != bitmap) bitmap.recycle();
        return scaled;
    }

    private static int calculateInSampleSize(BitmapFactory.Options options, int reqWidth, int reqHeight) {
        int height = options.outHeight;
        int width = options.outWidth;
        int inSampleSize = 1;
        if (height > reqHeight || width > reqWidth) {
            int halfHeight = height / 2;
            int halfWidth = width / 2;
            while ((halfHeight / inSampleSize) >= reqHeight && (halfWidth / inSampleSize) >= reqWidth) {
                inSampleSize *= 2;
            }
        }
        return inSampleSize;
    }

    private static int getRotation(String filePath) {
        try {
            ExifInterface exif = new ExifInterface(filePath);
            int orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            switch (orientation) {
                case ExifInterface.ORIENTATION_ROTATE_90: return 90;
                case ExifInterface.ORIENTATION_ROTATE_180: return 180;
                case ExifInterface.ORIENTATION_ROTATE_270: return 270;
                default: return 0;
            }
        } catch (IOException e) {
            return 0;
        }
    }

    public static String getExtension() {
        if (Build.VERSION.SDK_INT >= 30) {
            return "webp";
        }
        return "jpg";
    }
}
