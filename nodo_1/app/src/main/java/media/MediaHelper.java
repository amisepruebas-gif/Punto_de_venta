package media;

import android.net.Uri;

import com.google.firebase.storage.FirebaseStorage;
import com.google.firebase.storage.StorageReference;

import java.util.Calendar;

public class MediaHelper {

    public interface OnUploadListener {
        void onSuccess(String downloadUrl);
        void onFailure(String error);
    }

    public static void uploadImage(byte[] data, String messageId, String extension, OnUploadListener listener) {
        String path = buildPath(messageId, extension);
        StorageReference ref = FirebaseStorage.getInstance().getReference().child(path);
        ref.putBytes(data).addOnSuccessListener(taskSnapshot ->
            ref.getDownloadUrl().addOnSuccessListener(uri ->
                listener.onSuccess(uri.toString())
            ).addOnFailureListener(e -> listener.onFailure(e.getMessage()))
        ).addOnFailureListener(e -> listener.onFailure(e.getMessage()));
    }

    public static void uploadGif(Uri gifUri, String messageId, OnUploadListener listener) {
        String path = buildPath(messageId, "gif");
        StorageReference ref = FirebaseStorage.getInstance().getReference().child(path);
        ref.putFile(gifUri).addOnSuccessListener(taskSnapshot ->
            ref.getDownloadUrl().addOnSuccessListener(uri ->
                listener.onSuccess(uri.toString())
            ).addOnFailureListener(e -> listener.onFailure(e.getMessage()))
        ).addOnFailureListener(e -> listener.onFailure(e.getMessage()));
    }

    private static String buildPath(String messageId, String extension) {
        Calendar c = Calendar.getInstance();
        return "media/mensajes/" + c.get(Calendar.YEAR) + "/"
                + (c.get(Calendar.MONTH) + 1) + "/"
                + c.get(Calendar.DAY_OF_MONTH) + "/"
                + messageId + "." + extension;
    }
}
