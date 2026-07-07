package push;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.example.nodo_1.R;
import com.example.nodo_1.principal;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "MyFirebaseMsgService";
    public static final String CHANNEL_MENSAJES = "canal_mensajes";
    public static final String CHANNEL_VENTAS = "canal_ventas";
    public static final String CHANNEL_AJUSTES = "canal_ajustes";
    public static final String CHANNEL_GENERAL = "canal_general";

    @Override
    public void onCreate() {
        super.onCreate();
        crearCanales();
    }

    private void crearCanales() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;

            NotificationChannel chMensajes = new NotificationChannel(
                    CHANNEL_MENSAJES, "Mensajes", NotificationManager.IMPORTANCE_HIGH);
            chMensajes.setDescription("Notificaciones de mensajes nuevos");

            NotificationChannel chVentas = new NotificationChannel(
                    CHANNEL_VENTAS, "Ventas", NotificationManager.IMPORTANCE_DEFAULT);
            chVentas.setDescription("Notificaciones de ventas realizadas");

            NotificationChannel chAjustes = new NotificationChannel(
                    CHANNEL_AJUSTES, "Ajustes", NotificationManager.IMPORTANCE_DEFAULT);
            chAjustes.setDescription("Notificaciones de cambios de ajustes");

            NotificationChannel chGeneral = new NotificationChannel(
                    CHANNEL_GENERAL, "General", NotificationManager.IMPORTANCE_HIGH);
            chGeneral.setDescription("Notificaciones generales");

            nm.createNotificationChannel(chMensajes);
            nm.createNotificationChannel(chVentas);
            nm.createNotificationChannel(chAjustes);
            nm.createNotificationChannel(chGeneral);
        }
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Log.d(TAG, "Mensaje recibido de: " + remoteMessage.getFrom());

        String titulo = "Notificación";
        String cuerpo = "";
        String tipo = "general";

        if (remoteMessage.getData().size() > 0) {
            titulo = remoteMessage.getData().containsKey("titulo")
                    ? remoteMessage.getData().get("titulo") : titulo;
            cuerpo = remoteMessage.getData().containsKey("mensaje")
                    ? remoteMessage.getData().get("mensaje") : "";
            tipo = remoteMessage.getData().containsKey("tipo")
                    ? remoteMessage.getData().get("tipo") : "general";
        }

        if (remoteMessage.getNotification() != null) {
            if (remoteMessage.getNotification().getTitle() != null)
                titulo = remoteMessage.getNotification().getTitle();
            if (remoteMessage.getNotification().getBody() != null)
                cuerpo = remoteMessage.getNotification().getBody();
        }

        mostrarNotificacion(titulo, cuerpo, tipo);
    }

    private void mostrarNotificacion(String titulo, String cuerpo, String tipo) {
        String channelId;
        switch (tipo) {
            case "mensaje": channelId = CHANNEL_MENSAJES; break;
            case "venta":   channelId = CHANNEL_VENTAS; break;
            case "ajuste":  channelId = CHANNEL_AJUSTES; break;
            default:        channelId = CHANNEL_GENERAL; break;
        }

        Intent intent = new Intent(this, principal.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.drawable.amisetpeq)
                .setContentTitle(titulo)
                .setContentText(cuerpo)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "Permiso de notificaciones no concedido");
                return;
            }
        }

        int notificationId = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
        NotificationManagerCompat.from(this).notify(notificationId, builder.build());
    }

    @Override
    public void onNewToken(@NonNull String token) {
        Log.d(TAG, "Nuevo token FCM: " + token);
        FcmTokenManager.guardarTokenEnFirestore(getApplicationContext(), token);
    }
}
