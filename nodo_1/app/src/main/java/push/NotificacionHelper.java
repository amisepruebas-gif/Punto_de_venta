package push;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;

import com.example.nodo_1.fire;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;

import java.io.IOException;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.ResponseBody;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class NotificacionHelper {

    private static final String TAG = "NotificacionHelper";
    private static final String BASE_URL = "https://enviar-md6ghyedwa-uc.a.run.app/";
    private static NotificacionHelper instance;
    private Context context;

    private NotificacionHelper(Context context) {
        this.context = context.getApplicationContext();
    }

    public static synchronized NotificacionHelper getInstance(Context context) {
        if (instance == null) {
            instance = new NotificacionHelper(context);
        }
        return instance;
    }

    public void enviar(String titulo, String mensaje) {
        enviar(titulo, mensaje, "general");
    }

    public void enviar(String titulo, String mensaje, String tipo) {
        FirebaseUser usuario = FirebaseAuth.getInstance().getCurrentUser();
        if (usuario == null) {
            Log.w(TAG, "Usuario no autenticado");
            return;
        }

        usuario.getIdToken(true)
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful() && task.getResult().getToken() != null) {
                        String idToken = task.getResult().getToken();
                        enviarConToken(idToken, titulo, mensaje, tipo);
                    } else {
                        Log.e(TAG, "Error al obtener token de auth", task.getException());
                    }
                });
    }

    private void enviarConToken(String idToken, String titulo, String mensaje, String tipo) {
        OkHttpClient client = new OkHttpClient.Builder()
                .addInterceptor(chain -> {
                    Request original = chain.request();
                    Request req = original.newBuilder()
                            .header("Authorization", "Bearer " + idToken)
                            .method(original.method(), original.body())
                            .build();
                    return chain.proceed(req);
                })
                .addInterceptor(new HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BODY))
                .build();

        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build();

        ApiService api = retrofit.create(ApiService.class);
        NotificacionRequestTodos request = new NotificacionRequestTodos(titulo, mensaje, tipo);

        api.enviar(request).enqueue(new Callback<ResponseBody>() {
            @Override
            public void onResponse(@NonNull Call<ResponseBody> call, @NonNull Response<ResponseBody> response) {
                if (response.isSuccessful()) {
                    Log.d(TAG, "Notificación push enviada");
                } else {
                    try {
                        String err = response.errorBody() != null ? response.errorBody().string() : "sin detalle";
                        Log.e(TAG, "Error enviando push: " + response.code() + " - " + err);
                    } catch (IOException e) { Log.e(TAG, "Error leyendo respuesta", e); }
                }
            }

            @Override
            public void onFailure(@NonNull Call<ResponseBody> call, @NonNull Throwable t) {
                Log.e(TAG, "Fallo de conexión al enviar push", t);
            }
        });
    }
}
