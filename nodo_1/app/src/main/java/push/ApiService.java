package push;

import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.Headers;
import retrofit2.http.POST;

public interface ApiService {
    @Headers("Content-Type: application/json")
    @POST(".")
    Call<ResponseBody> enviar(@Body NotificacionRequestTodos notificacionRequestTodos);
}
