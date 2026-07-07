package pop;


import static com.example.nodo_1.generales.actualizarDatosGuardados;
import static com.example.nodo_1.generales.getAnñoMesDiaHora;
import static com.example.nodo_1.principal.jsonDatos;
import static com.example.nodo_1.principal.jsonMensajes_n;
import static com.example.nodo_1.principal.objectFechasMensaje;
import static descarga_init.descarga.unavezMensaje;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.ItemTouchHelper;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.SwipeToDeleteCallback;
import com.example.nodo_1.actualizar_venta_mensaje_paseDeLista;
import com.example.nodo_1.editar_articulos;
import com.example.nodo_1.fire;
import com.example.nodo_1.generales;
import com.example.nodo_1.principal;
import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.TimeZone;

import adapter.adap_mensajes;
import media.ImageCompressor;
import media.MediaHelper;


public class pop_mensajes {
    public static final int REQUEST_PICK_IMAGE = 1001;
    String idDispositivo;
    PopupWindow popupWindow_ = null;
    RecyclerView recyclerView;
    private LinearLayoutManager layoutManager;
    adapter.adap_mensajes adap_mensajes;
    ConstraintLayout consReply, consBajarRecycler;
    TextView replyEncabezado, replyTexto;
    EditText edit_mensaje;
    Button but_BajarRecycler;
    int cantidad = 70; //mensajes Leer
    String enTurnoGuardado;


    public void showPopupWindow(final View view, String enTurno, String idDispositivo) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.mensajes, null);

        //Specify the length and width through constants
        int width  = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);
        popupWindow_        = popupWindow;
        context             = popupView.getContext();
        this.idDispositivo       = idDispositivo;
        consReply           = (ConstraintLayout)popupView.findViewById(R.id.consRespuestaMensaje);
        consBajarRecycler   = (ConstraintLayout)popupView.findViewById(R.id.consBajarRecycler);
        replyEncabezado     = (TextView)popupView.findViewById(R.id.textView634);
        replyTexto          = (TextView)popupView.findViewById(R.id.textView635);
        but_BajarRecycler   = (Button)popupView.findViewById(R.id.button198);


        recyclerView = (RecyclerView) popupView.findViewById(R.id.recyclerMensajes);
        generales.recyclerVertical(recyclerView, popupView.getContext());

        JSONArray array = leerMensajes(cantidad, popupView.getContext());
        if(array == null){
            adap_mensajes = new adap_mensajes(new JSONArray()
                    , popupView.getContext(), this);
            recyclerView.setAdapter(adap_mensajes);
        }else {
            adap_mensajes = new adap_mensajes(array
                    , popupView.getContext(), this);

            recyclerView.setAdapter(adap_mensajes);
            recyclerView.scrollToPosition(adap_mensajes.getItemCount() - 1);
            itemTouchHelper = new ItemTouchHelper(new SwipeToDeleteCallback(adap_mensajes,100));
            itemTouchHelper.attachToRecyclerView(recyclerView);
            layoutManager = (LinearLayoutManager) recyclerView.getLayoutManager();
            recyclerView.addOnScrollListener(new RecyclerView.OnScrollListener() {
                @Override
                public void onScrolled(@NonNull RecyclerView recyclerView, int dx, int dy) {
                    super.onScrolled(recyclerView, dx, dy);
                    // Obtiene la posición del primer y último elemento visible en la pantalla
                    int firstVisibleItem = layoutManager.findFirstVisibleItemPosition();
                    int lastVisibleItem = layoutManager.findLastVisibleItemPosition();

                    // Verifica si el elemento específico está visible en la pantalla
                    if (adap_mensajes.getItemCount()-1 >= firstVisibleItem && adap_mensajes.getItemCount()-1 <= lastVisibleItem) {
                        // El elemento está visible en la pantalla
                        // Realiza acciones específicas aquí
                        consBajarRecycler.setVisibility(View.GONE);
                    } else {
                        // El elemento no está visible en la pantalla
                        consBajarRecycler.setVisibility(View.VISIBLE);
                    }
                }
            });
        }

        Button butCerrarReply = (Button)popupView.findViewById(R.id.button200);
        butCerrarReply.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                consReply.setVisibility(View.GONE);
            }
        });

        edit_mensaje = (EditText)popupView.findViewById(R.id.editTextText5);
        enTurnoGuardado = enTurno;
        Button but_Adjuntar = (Button) popupView.findViewById(R.id.butAdjuntar);
        but_Adjuntar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.setType("image/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/jpeg", "image/png", "image/gif", "image/webp"});
                if (context instanceof Activity) {
                    ((Activity) context).startActivityForResult(intent, REQUEST_PICK_IMAGE);
                }
            }
        });
        Button but_Enviar = (Button) popupView.findViewById(R.id.button196);
        but_Enviar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                mandarMensaje(enTurno);
            }
        });
        edit_mensaje.setSingleLine();
        edit_mensaje.setOnKeyListener(new View.OnKeyListener() {
            @Override
            public boolean onKey(View v, int keyCode, KeyEvent event) {
                if ((event.getAction() == KeyEvent.ACTION_DOWN) && (keyCode == KeyEvent.KEYCODE_ENTER)) {
                    mandarMensaje(enTurno);
                }
                return (keyCode == KeyEvent.KEYCODE_ENTER);
            }
        });
        but_BajarRecycler.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                recyclerView.scrollToPosition(adap_mensajes.getItemCount() - 1);
            }
        });
    }
    public void reply_deslizar(int index){
        consReply.setVisibility(View.VISIBLE);
        recyclerView.scrollToPosition(index);
        try {
            replyEncabezado.setText(adap_mensajes.getArray().getJSONObject(index).getString("usuario"));
            replyTexto.setText(adap_mensajes.getArray().getJSONObject(index).getString("texto"));

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        /*

         */
        //imm_editTextTexto();
        //notifyItemChanged(i);
    }
    public void mandarMensaje(String enTurno){
        principal.huellaMensaje_generada = editar_articulos.generarID();
        Calendar c = Calendar.getInstance();
        String año = "20" + getAnñoMesDiaHora("año");
        String mes = generales.quitarCero(getAnñoMesDiaHora("mes"));
        String dia = generales.quitarCero(getAnñoMesDiaHora("dia"));

        if(edit_mensaje.length() > 0){
            JSONObject objDatosMensaje = new JSONObject();
            try {
                /**  DATOS BASE  **/
                objDatosMensaje.put("hora"      ,getTiempo());
                objDatosMensaje.put("id"        ,idDispositivo);
                objDatosMensaje.put("usuario"   ,enTurno);
                objDatosMensaje.put("texto"     ,edit_mensaje.getText().toString());
                objDatosMensaje.put("huella"          , principal.huellaMensaje_generada);

            } catch (JSONException e) {
                throw new RuntimeException(e);
            }


            if(consReply.getVisibility() == View.VISIBLE){
                try {
                    objDatosMensaje.put("reply", "");
                    objDatosMensaje.put("replyEncabezado", replyEncabezado.getText().toString());
                    objDatosMensaje.put("replyTexto",      replyTexto.getText().toString());
                    consReply.setVisibility(View.GONE);
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
            String fechaNoExiste = "";
            JSONObject objectDia = new JSONObject();
            JSONObject objectMes = new JSONObject();

            if(jsonMensajes_n.length()>0){
                if(jsonMensajes_n.has(String.valueOf(c.get(Calendar.YEAR)))){
                    try {
                        if(jsonMensajes_n.getJSONObject(String.valueOf(c.get(Calendar.YEAR))).has(String.valueOf(c.get(Calendar.MONTH) +1 ))){
                            if (jsonMensajes_n.getJSONObject(String.valueOf(c.get(Calendar.YEAR))).
                                    getJSONObject(String.valueOf(c.get(Calendar.MONTH) +1 )).has(String.valueOf(c.get(Calendar.DAY_OF_MONTH)))){

                            }else fechaNoExiste = "dia";
                        }else fechaNoExiste = "mes";
                    } catch (JSONException e_) {
                        throw new RuntimeException(e_);
                    }
                }else fechaNoExiste = "año";

                if(!fechaNoExiste.equals("")){
                    //JSONObject objectMensaje = new JSONObject();
                    switch (fechaNoExiste){
                        case "año":
                            try {
                                objDatosMensaje.put("inicioAño"     , año);
                                objDatosMensaje.put("inicioDeMes"   , mes);
                                objDatosMensaje.put("nuevoDia"      , dia);
                                //objectMensaje.put("1", objDatosMensaje);

                                JSONArray array = new JSONArray();
                                array.put(objDatosMensaje);
                                objectDia.put(dia, array);
                                objectMes.put(mes, objectDia);

                                jsonMensajes_n.put( año, objectMes);

                                JSONObject object = new JSONObject();
                                object.put("mensajes", array);
                                fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).
                                        set(new Gson().fromJson(
                                                object.toString(), HashMap.class));


                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                            break;
                        case "mes":
                            try {
                                objDatosMensaje.put("inicioDeMes"   ,mes);
                                objDatosMensaje.put("nuevoDia"      ,dia);

                                //objectMensaje.put("1", objDatosMensaje);
                                JSONArray array = new JSONArray();
                                array.put(objDatosMensaje);
                                objectDia.put(dia, array);
                                jsonMensajes_n.getJSONObject(año).put(mes, objectDia);

                                JSONObject object = new JSONObject();
                                object.put("mensajes", array);
                                fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).
                                        set(new Gson().fromJson(
                                                object.toString(), HashMap.class));


                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                            break;
                        case "dia":
                            try {
                                objDatosMensaje.put("nuevoDia"      , dia);

                                //objectMensaje.put("1", objDatosMensaje);

                                JSONArray array = new JSONArray();

                                array.put(objDatosMensaje);

                                jsonMensajes_n.
                                        getJSONObject(año).
                                        getJSONObject(mes).
                                        put(dia, array);

                                JSONObject object = new JSONObject();
                                object.put("mensajes", array);

                                fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).
                                        set(new Gson().fromJson(
                                                object.toString(), HashMap.class));



                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                            break;
                    }

                }else {
                    try {
                        jsonMensajes_n.
                                getJSONObject(año).
                                getJSONObject(mes).
                                getJSONArray(dia).put(objDatosMensaje);

                        JSONObject object = new JSONObject();
                        object.put("mensajes", jsonMensajes_n.
                                getJSONObject(año).
                                getJSONObject(mes).
                                getJSONArray(dia));
                        fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).
                                set(new Gson().fromJson(
                                        object.toString(), HashMap.class));
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            }else {
                try {
                    objDatosMensaje.put("nuevoDia"      , dia);
                    JSONArray array = new JSONArray();
                    array.put(objDatosMensaje);
                    objectDia.put(dia, array);
                    objectMes.put(mes, objectDia);

                    jsonMensajes_n.put(año, objectMes);

                    JSONObject object = new JSONObject();
                    object.put("mensajes", array);
                    fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).
                            set(new Gson().fromJson(
                                    object.toString(), HashMap.class));
                } catch (JSONException e) {
                e.printStackTrace();
            }

            }
            try{
                if(objectFechasMensaje.length() > 0){
                    if (objectFechasMensaje.has(año)){
                        if (objectFechasMensaje.getJSONObject(año).has(mes)){
                            if(objectFechasMensaje.getJSONObject(año).getJSONObject(mes).has(dia)){
                                objectFechasMensaje.getJSONObject(año).getJSONObject(mes).put(dia,
                                        String.valueOf(Integer.parseInt(
                                                objectFechasMensaje.getJSONObject(año).getJSONObject(mes).getString(dia)
                                        ) + 1));
                            }else {
                                objectFechasMensaje.getJSONObject(año).getJSONObject(mes).put(dia,"1");
                            }

                        }else {
                            JSONObject object = new JSONObject();
                            object.put(dia, "1");
                            objectFechasMensaje.getJSONObject(año).put(mes, object);
                        }
                    }else {
                        JSONObject object = new JSONObject();
                        object.put(dia, "1");
                        JSONObject objMes = new JSONObject();
                        objMes.put(mes, object);
                        objectFechasMensaje.put(año, objMes);
                    }

                }else {
                    JSONObject object = new JSONObject();
                    object.put(dia, "1");
                    JSONObject objMes = new JSONObject();
                    objMes.put(mes, object);
                    objectFechasMensaje.put(año, objMes);
                }
                //objectFechasMensaje

                fire.documenRef("mensajes_n/" + año).
                        set(new Gson().fromJson(
                                objectFechasMensaje.getJSONObject(año).toString(), HashMap.class));

                actualizarDatosGuardados("objectFechasMensaje"    , objectFechasMensaje.toString()  , context);

                unavezMensaje = false;

                actualizar_venta_mensaje_paseDeLista.mensaje(context);


            }catch (JSONException e){
                throw new RuntimeException();
            }

            generales.actualizarDatosGuardados("objectFechasMensaje", objectFechasMensaje.toString(),context);
            generales.actualizarDatosGuardados("jsonMensajes_n", jsonMensajes_n.toString(),context);
            generales.actualizarDatosGuardados("jsonDatos",      jsonDatos.toString(),context);
            addJSON_adapter(objDatosMensaje);
            push.NotificacionHelper.getInstance(context)
                    .enviar("Nuevo mensaje", edit_mensaje.getText().toString(), "mensaje");
            edit_mensaje.setText("");
        }
    }
    public static JSONArray invertJSONArray(JSONArray jsonArray) {
        if (jsonArray != null){
            List<Object> list = new ArrayList<>();
            for (int i = jsonArray.length() - 1; i >= 0; i--) {
                try {
                    list.add(jsonArray.get(i));
                } catch (JSONException e) {
                    e.printStackTrace();
                }
            }
            return new JSONArray(list);
        }else return null;

    }

    private JSONArray leerMensajes(int cantidad, Context context){
        JSONArray array = new JSONArray();
        boolean esatdo = false;
        if(jsonMensajes_n.length() > 0){
            for (int i = jsonMensajes_n.names().length()-1; i >=0  ; i--){
                try {
                    int[] año = acomodarIndices(jsonMensajes_n);

                    JSONObject objMes = new JSONObject(jsonMensajes_n.getJSONObject(String.valueOf(año[i])).toString());

                    int[] mes = acomodarIndices(objMes);

                    for (int x = objMes.names().length()-1; x >= 0 ; x--){
                        JSONObject objDia = objMes.getJSONObject(String.valueOf(mes[x]));

                        int[] dia = acomodarIndices(objDia);
                        for (int z = objDia.names().length()-1; z >= 0 ; z--){

                            JSONArray array_Mensaje = objDia.getJSONArray(String.valueOf(dia[z]));

                            //int[] mensaje = acomodarIndices(objMensaje);

                            for (int y = array_Mensaje.length()-1; y >= 0  ; y--){

                                if (array.length() > cantidad){
                                    array_Mensaje.getJSONObject(y).put("final", "");
                                    array.put(array_Mensaje.getJSONObject(y));
                                    esatdo = true;
                                    break;
                                }else {
                                    array.put(array_Mensaje.getJSONObject(y));
                                }
                            }
                            if(esatdo){break;}
                        }
                        if(esatdo){break;}
                    }

                } catch (JSONException e) {
                    generales.toast("error", context);
                    throw new RuntimeException(e);
                }
                if(esatdo){break;}
            }
        }else array = null;

        return invertJSONArray(array);
    }
    private int[] acomodarIndices(JSONObject object){
        int[] acomodar = new int[object.names().length()];
        for (int l = 0; l < acomodar.length; l++){
            try {
                acomodar[l] = Integer.parseInt(object.names().getString(l));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        Arrays.sort(acomodar);
        return acomodar;
    }
    private String getTiempo(){
        TimeZone myTimeZone = TimeZone.getTimeZone("America/Mexico_City");
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        simpleDateFormat.setTimeZone(myTimeZone);
        String dateTime = simpleDateFormat.format(new Date());
        return  dateTime;
    }
    Context context;
    public boolean estadoPop(){
        return popupWindow_.isShowing();
    }
    public void imm_editTextTexto(){
        InputMethodManager imm = (InputMethodManager) context.getSystemService(Context.INPUT_METHOD_SERVICE);
        edit_mensaje.requestFocus();
        imm.showSoftInput(edit_mensaje, InputMethodManager.SHOW_IMPLICIT);
    }
    int cantAnterior;
    int carga = 1;
    int cantidadFija = 70;
    ItemTouchHelper itemTouchHelper;
    public void actualizarAdaptadorCargaMensajes(boolean estadoCarga){
        int canPosterion;
        cantAnterior = adap_mensajes.getItemCount();
        if(estadoCarga)carga = carga + 1;
        cantidad = cantidadFija * carga;
        adap_mensajes.actualizar(leerMensajes(cantidad, context));
        canPosterion = adap_mensajes.getItemCount() - cantAnterior;
        if(estadoCarga)recyclerView.scrollToPosition(canPosterion);
        else recyclerView.scrollToPosition(adap_mensajes.getItemCount()-1);
    }
    public void addJSON_adapter(JSONObject object){
        adap_mensajes.add(object);
        if (adap_mensajes.getItemCount() > 0){
            recyclerView.scrollToPosition(adap_mensajes.getItemCount() - 1);
        }

    }
    public void onMediaResult(Uri uri) {
        if (uri == null || context == null) return;
        String mimeType = context.getContentResolver().getType(uri);
        boolean isGif = mimeType != null && mimeType.equals("image/gif");

        principal.huellaMensaje_generada = editar_articulos.generarID();
        String huella = principal.huellaMensaje_generada;

        if (isGif) {
            MediaHelper.uploadGif(uri, huella, new MediaHelper.OnUploadListener() {
                @Override
                public void onSuccess(String downloadUrl) {
                    mandarMensajeMedia(enTurnoGuardado, "gif", downloadUrl);
                }
                @Override
                public void onFailure(String error) {
                    Toast.makeText(context, "Error al subir GIF", Toast.LENGTH_SHORT).show();
                }
            });
        } else {
            new Thread(() -> {
                String filePath = getFilePathFromUri(uri);
                if (filePath == null) {
                    filePath = copyUriToTempFile(uri);
                }
                if (filePath == null) return;
                byte[] compressed = ImageCompressor.compress(filePath);
                if (compressed == null) return;
                String ext = ImageCompressor.getExtension();
                ((Activity) context).runOnUiThread(() -> {
                    MediaHelper.uploadImage(compressed, huella, ext, new MediaHelper.OnUploadListener() {
                        @Override
                        public void onSuccess(String downloadUrl) {
                            mandarMensajeMedia(enTurnoGuardado, "imagen", downloadUrl);
                        }
                        @Override
                        public void onFailure(String error) {
                            Toast.makeText(context, "Error al subir imagen", Toast.LENGTH_SHORT).show();
                        }
                    });
                });
            }).start();
        }
    }

    private void mandarMensajeMedia(String enTurno, String tipo, String mediaUrl) {
        Calendar c = Calendar.getInstance();
        String año = "20" + getAnñoMesDiaHora("año");
        String mes = generales.quitarCero(getAnñoMesDiaHora("mes"));
        String dia = generales.quitarCero(getAnñoMesDiaHora("dia"));

        JSONObject objDatosMensaje = new JSONObject();
        try {
            objDatosMensaje.put("hora", getTiempo());
            objDatosMensaje.put("id", idDispositivo);
            objDatosMensaje.put("usuario", enTurno);
            objDatosMensaje.put("texto", edit_mensaje.getText().toString());
            objDatosMensaje.put("huella", principal.huellaMensaje_generada);
            objDatosMensaje.put("tipo", tipo);
            objDatosMensaje.put("mediaUrl", mediaUrl);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

        String fechaNoExiste = "";
        JSONObject objectDia = new JSONObject();
        JSONObject objectMes = new JSONObject();

        if (jsonMensajes_n.length() > 0) {
            if (jsonMensajes_n.has(String.valueOf(c.get(Calendar.YEAR)))) {
                try {
                    if (jsonMensajes_n.getJSONObject(String.valueOf(c.get(Calendar.YEAR))).has(String.valueOf(c.get(Calendar.MONTH) + 1))) {
                        if (jsonMensajes_n.getJSONObject(String.valueOf(c.get(Calendar.YEAR))).
                                getJSONObject(String.valueOf(c.get(Calendar.MONTH) + 1)).has(String.valueOf(c.get(Calendar.DAY_OF_MONTH)))) {
                        } else fechaNoExiste = "dia";
                    } else fechaNoExiste = "mes";
                } catch (JSONException e_) {
                    throw new RuntimeException(e_);
                }
            } else fechaNoExiste = "año";

            if (!fechaNoExiste.equals("")) {
                switch (fechaNoExiste) {
                    case "año":
                        try {
                            objDatosMensaje.put("inicioAño", año);
                            objDatosMensaje.put("inicioDeMes", mes);
                            objDatosMensaje.put("nuevoDia", dia);
                            JSONArray array = new JSONArray();
                            array.put(objDatosMensaje);
                            objectDia.put(dia, array);
                            objectMes.put(mes, objectDia);
                            jsonMensajes_n.put(año, objectMes);
                            JSONObject object = new JSONObject();
                            object.put("mensajes", array);
                            fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).
                                    set(new Gson().fromJson(object.toString(), HashMap.class));
                        } catch (JSONException e) { throw new RuntimeException(e); }
                        break;
                    case "mes":
                        try {
                            objDatosMensaje.put("inicioDeMes", mes);
                            objDatosMensaje.put("nuevoDia", dia);
                            JSONArray array = new JSONArray();
                            array.put(objDatosMensaje);
                            objectDia.put(dia, array);
                            jsonMensajes_n.getJSONObject(año).put(mes, objectDia);
                            JSONObject object = new JSONObject();
                            object.put("mensajes", array);
                            fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).
                                    set(new Gson().fromJson(object.toString(), HashMap.class));
                        } catch (JSONException e) { throw new RuntimeException(e); }
                        break;
                    case "dia":
                        try {
                            objDatosMensaje.put("nuevoDia", dia);
                            JSONArray array = new JSONArray();
                            array.put(objDatosMensaje);
                            jsonMensajes_n.getJSONObject(año).getJSONObject(mes).put(dia, array);
                            JSONObject object = new JSONObject();
                            object.put("mensajes", array);
                            fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).
                                    set(new Gson().fromJson(object.toString(), HashMap.class));
                        } catch (JSONException e) { throw new RuntimeException(e); }
                        break;
                }
            } else {
                try {
                    jsonMensajes_n.getJSONObject(año).getJSONObject(mes).getJSONArray(dia).put(objDatosMensaje);
                    JSONObject object = new JSONObject();
                    object.put("mensajes", jsonMensajes_n.getJSONObject(año).getJSONObject(mes).getJSONArray(dia));
                    fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).
                            set(new Gson().fromJson(object.toString(), HashMap.class));
                } catch (JSONException e) { throw new RuntimeException(e); }
            }
        } else {
            try {
                objDatosMensaje.put("nuevoDia", dia);
                JSONArray array = new JSONArray();
                array.put(objDatosMensaje);
                objectDia.put(dia, array);
                objectMes.put(mes, objectDia);
                jsonMensajes_n.put(año, objectMes);
                JSONObject object = new JSONObject();
                object.put("mensajes", array);
                fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).
                        set(new Gson().fromJson(object.toString(), HashMap.class));
            } catch (JSONException e) { e.printStackTrace(); }
        }

        try {
            if (objectFechasMensaje.length() > 0) {
                if (objectFechasMensaje.has(año)) {
                    if (objectFechasMensaje.getJSONObject(año).has(mes)) {
                        if (objectFechasMensaje.getJSONObject(año).getJSONObject(mes).has(dia)) {
                            objectFechasMensaje.getJSONObject(año).getJSONObject(mes).put(dia,
                                    String.valueOf(Integer.parseInt(
                                            objectFechasMensaje.getJSONObject(año).getJSONObject(mes).getString(dia)) + 1));
                        } else {
                            objectFechasMensaje.getJSONObject(año).getJSONObject(mes).put(dia, "1");
                        }
                    } else {
                        JSONObject object = new JSONObject();
                        object.put(dia, "1");
                        objectFechasMensaje.getJSONObject(año).put(mes, object);
                    }
                } else {
                    JSONObject object = new JSONObject();
                    object.put(dia, "1");
                    JSONObject objMes = new JSONObject();
                    objMes.put(mes, object);
                    objectFechasMensaje.put(año, objMes);
                }
            } else {
                JSONObject object = new JSONObject();
                object.put(dia, "1");
                JSONObject objMes = new JSONObject();
                objMes.put(mes, object);
                objectFechasMensaje.put(año, objMes);
            }

            fire.documenRef("mensajes_n/" + año).
                    set(new Gson().fromJson(objectFechasMensaje.getJSONObject(año).toString(), HashMap.class));
            actualizarDatosGuardados("objectFechasMensaje", objectFechasMensaje.toString(), context);
            unavezMensaje = false;
            actualizar_venta_mensaje_paseDeLista.mensaje(context);
        } catch (JSONException e) { throw new RuntimeException(); }

        generales.actualizarDatosGuardados("objectFechasMensaje", objectFechasMensaje.toString(), context);
        generales.actualizarDatosGuardados("jsonMensajes_n", jsonMensajes_n.toString(), context);
        generales.actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), context);
        addJSON_adapter(objDatosMensaje);
        edit_mensaje.setText("");
    }

    private String getFilePathFromUri(Uri uri) {
        try {
            String[] projection = {MediaStore.Images.Media.DATA};
            Cursor cursor = context.getContentResolver().query(uri, projection, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATA);
                String path = cursor.getString(index);
                cursor.close();
                return path;
            }
            if (cursor != null) cursor.close();
        } catch (Exception e) { /* fallback to copy */ }
        return null;
    }

    private String copyUriToTempFile(Uri uri) {
        try {
            InputStream is = context.getContentResolver().openInputStream(uri);
            if (is == null) return null;
            File tempFile = new File(context.getCacheDir(), "temp_img_" + System.currentTimeMillis());
            FileOutputStream fos = new FileOutputStream(tempFile);
            byte[] buffer = new byte[4096];
            int read;
            while ((read = is.read(buffer)) != -1) {
                fos.write(buffer, 0, read);
            }
            fos.close();
            is.close();
            return tempFile.getAbsolutePath();
        } catch (Exception e) {
            return null;
        }
    }
}
/*
    private void registroMensajes(String indice, int[] index){

        for (int x = 0; x < index.length; x++){
            try {
                object_orden_mensajes.put(indice, String.valueOf(index[x]));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
    }
 */