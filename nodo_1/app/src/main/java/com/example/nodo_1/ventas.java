package com.example.nodo_1;


import static com.example.nodo_1.fire.documenRef;
import static com.example.nodo_1.generales.loadData_sharedPreferences;
import static com.example.nodo_1.generales.saveData_sharedPreferences;
import static com.example.nodo_1.principal.jsonArticulos;
import static com.example.nodo_1.principal.jsonDatos;
import static com.example.nodo_1.principal.jsonVenta;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.viewpager.widget.ViewPager;

import com.google.firebase.firestore.DocumentSnapshot;
import com.google.gson.Gson;
import com.sothree.slidinguppanel.SlidingUpPanelLayout;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;

import adapter.Model;
import adapter.adapterModel;
import pop.pop_mensajes;

public class ventas extends AppCompatActivity implements View.OnClickListener {



    TextView textView_Hist_dia;
    TextView textView_Hist_mes;
    TextView textView_Hist_año;
    TextView txtIngresoTotalHist;
    TextView textView_Hist_DiaTexto;
    public RecyclerView recyclerHistorial_dos;
    public adapter.adapterHistorialDos adapterHistorialDos;
    TextView sumaSeleccion, retInversion, utilidad;


    ConstraintLayout cons_ven_lat_acciones;
    ConstraintLayout consVenAccionesPrincipales;




  /*
    public void escucharVenta(JSONObject obj){
    }
   */


    private BroadcastReceiver updateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {

            String llave  = "";
            if (intent.hasExtra("datos")){
                llave = intent.getStringExtra("datos");
            }
            String fecha = "", datos = "";
            if (intent.hasExtra("fecha")){
                fecha = intent.getStringExtra("fecha");
            }
            if (intent.hasExtra("extra_data")){
                datos = intent.getStringExtra("extra_data");
            }


            if(llave.equals("venta")){
                Calendar c = Calendar.getInstance();

                String año = String.valueOf(c.get(Calendar.YEAR));
                String mes = String.valueOf(c.get(Calendar.MONTH) +1);
                String dia = String.valueOf(c.get(Calendar.DAY_OF_MONTH));

                if((año + "-" + mes + "-" + dia).equals(fecha)){
                    try {
                        JSONArray arrayVenta = jsonVenta.getJSONObject(año).getJSONObject(mes).getJSONObject(dia).getJSONArray("registro");
                        adapterHistorialDos.add(arrayVenta.getJSONObject(arrayVenta.length()-1));
                        ganacias(adapterHistorialDos.getArray());
                        ((Button)findViewById(R.id.recorrerRecycler_venta)).setVisibility(View.VISIBLE);
                        toast("NUEVA VENTA REGISTRADA");
                        MediaPlayer mpMensaje;
                        mpMensaje = MediaPlayer.create(context, R.raw.ventarealizada);
                        mpMensaje.start();
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
                // Maneja los datos recibidos
            }else if(llave.equals("mensaje")){
                try {
                    actualizarMensajesPop(new JSONObject(datos));
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }
    };
    public void actualizarMensajesPop(JSONObject object){
        if (pop_mensajes != null && pop_mensajes.estadoPop()) {
            pop_mensajes.addJSON_adapter(object);
        } else {
            String cant_share = loadData_sharedPreferences(getApplicationContext(),"key_cant_mensaje","mensaje");
            int mensjeRecibido;
            if(!cant_share.equals("")){
                mensjeRecibido = Integer.parseInt(cant_share) + 1;
                saveData_sharedPreferences(getApplicationContext(),"mensaje", "key_cant_mensaje", String.valueOf(mensjeRecibido));
            }else {
                mensjeRecibido = 1;
                saveData_sharedPreferences(getApplicationContext(),"mensaje", "key_cant_mensaje", "1");
            }
            TextView textView = (TextView)findViewById(R.id.textView_mensaje);
            textView.setVisibility(View.VISIBLE);
            String cant = "+ " + String.valueOf(mensjeRecibido);
            textView.setText(cant);
            MediaPlayer mpMensaje;
            mpMensaje = MediaPlayer.create(getApplicationContext(), R.raw.notificacion_1);
            mpMensaje.setVolume(100, 100);
            ((Button)findViewById(R.id.button70Mensaje)).setBackgroundDrawable(getResources().getDrawable(R.drawable.mensaje_naranja));
            mpMensaje.start();
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        mensajeRecibidoCargadoEnshar();
        IntentFilter intentFilter = new IntentFilter();
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_venta_ac");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_mensajes_ac");
        LocalBroadcastManager.getInstance(this).registerReceiver(updateReceiver, intentFilter);
    }

    @Override
    protected void onStop() {
        super.onStop();
        LocalBroadcastManager.getInstance(this).unregisterReceiver(updateReceiver);
    }
    private void mensajeRecibidoCargadoEnshar(){
        String cant_share = loadData_sharedPreferences(getApplicationContext(),"key_cant_mensaje","mensaje");
        if(!cant_share.equals("")){
            int mensjeRecibido;
            mensjeRecibido = Integer.parseInt(cant_share);
            saveData_sharedPreferences(getApplicationContext(),"mensaje", "key_cant_mensaje", String.valueOf(mensjeRecibido));
            TextView textView = (TextView)findViewById(R.id.textView_mensaje);
            textView.setVisibility(View.VISIBLE);
            String cant = "+ " + String.valueOf(mensjeRecibido);
            textView.setText(cant);
            ((Button)findViewById(R.id.button70Mensaje)).setBackgroundDrawable(getResources().getDrawable(R.drawable.mensaje_naranja));
        }else {
            ((Button)findViewById(R.id.button70Mensaje)).setBackgroundDrawable(getResources().getDrawable(R.drawable.mensaje_blamco));
            TextView textView = (TextView)findViewById(R.id.textView_mensaje);
            textView.setVisibility(View.GONE);
            textView.setText("");
        }
    }

    private void llenarCampos() throws JSONException {

        JSONArray array = jsonArray();
        /*
        ganacias(array);
        TextView diaNumero = (TextView)findViewById(R.id.textView_Hist_dia);
        TextView diaNombre = (TextView)findViewById(R.id.textView_Hist_dia3);
        TextView mesNombre = (TextView)findViewById(R.id.textView_Hist_mes);
        TextView añoNombre = (TextView)findViewById(R.id.textView_Hist_año);

        diaNombre.setText(array.getJSONObject(0).getString("dia"));
        mesNombre.setText(numeroAmes(array.getJSONObject(0).getString("idVenta").split(" ")[1]));
        añoNombre.setText(array.getJSONObject(0).getString("idVenta").split(" ")[0]);
        diaNumero.setText(array.getJSONObject(0).getString("idVenta").split(" ")[2]);

         */
        adapterHistorialDos = new adapter.adapterHistorialDos(
                array,
                getApplicationContext(),
                sumaSeleccion,
                "",
                null,
                recyclerHistorial_dos,
                ultimoAño + " " + ultimoMes + " " + ultimoDia
        );
        recyclerHistorial_dos.setAdapter(adapterHistorialDos);


        models = new ArrayList<>();
        int cantidadMeses = 0;
        for(int i = 0; i < jsonVenta.names().length(); i++){
            try {
                JSONObject objectMes = jsonVenta.getJSONObject(jsonVenta.names().getString(i));
                for (int x = 0; x < objectMes.names().length(); x++){
                    cantidadMeses++;
                    JSONObject objectDias = objectMes.getJSONObject(objectMes.names().getString(x));
                    ArrayList<String> cadenaIdBt = new ArrayList<>();
                    ArrayList<String> list = new ArrayList<>();
                    for (int y = 0; y < objectDias.names().length(); y++){

                        cadenaIdBt.add(objectDias.names().getString(y));

                        JSONObject objectVentas = objectDias.getJSONObject(objectDias.names().getString(y));

                        list.add("0");
                    }
                    models.add(
                            new Model(
                                    R.drawable.brochure,
                                    objectMes.names().getString(x)+ " " + jsonVenta.names().getString(i),
                                    cadenaIdBt,
                                    null,
                                    objectMes.names().getString(x),
                                    list,
                                    new JSONObject()));

                }

            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        adapterModel = new
                adapterModel(
                models,
                getApplicationContext(), null);

        viewPager = findViewById(R.id.viewPager);

        viewPager.setAdapter(adapterModel);
        viewPager.setPadding(0, 0, 00, 0);
        viewPager.setCurrentItem(cantidadMeses-1);

        viewPager.addOnPageChangeListener(new ViewPager.OnPageChangeListener() {
            @Override
            public void onPageScrolled(int position, float positionOffset, int positionOffsetPixels) {

            }

            @Override
            public void onPageSelected(int position) {
                adapterModel.resetVentaXdiaF();
            }

            @Override
            public void onPageScrollStateChanged(int state) {

            }
        });

        masVendidoIniciarAdapter();
    }

    private JSONObject convertDocumentSnapshotToJsonObject(DocumentSnapshot document) {
        JSONObject jsonObject = new JSONObject();
        if (document != null && document.exists()) {
            jsonObject = new JSONObject(document.getData());
        }
        return jsonObject;
    }
    private String getAnñoMesDiaHora(String get){
        TimeZone myTimeZone = TimeZone.getTimeZone("America/Mexico_City");
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        simpleDateFormat.setTimeZone(myTimeZone);
        String dateTime = simpleDateFormat.format(new Date());
        //                                2020-08-20 16:40:34
        if(get.equals("año")){return "20" + (dateTime.split(" ")[0]).split("-")[0].substring(2);}
        else if (get.equals("mes")){return quitarCero((dateTime.split(" ")[0]).split("-")[1]);}
        else if (get.equals("dia")){return quitarCero((dateTime.split(" ")[0]).split("-")[2]);}
        else if (get.equals("hora")){return (dateTime.split(" ")[1]);}
        return "null";
    }
    private String quitarCero(String s){
        if (s.length() > 1) {
            if (s.charAt(0) == '0') {
                s = Character.toString(s.charAt(1));
            }
        }
        return s;
    }
    List<Model> models;
    adapterModel adapterModel;
    ViewPager viewPager;

    RecyclerView recyclerSurtir_traslado;

    adapter.adapVista_surtir_en_venta adapVista_surtir_en_venta;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);

        setContentView(R.layout.ventas);

        sliding = (SlidingUpPanelLayout) findViewById(R.id.panelStateActivityMain);
        recyclerHistorial_dos = (RecyclerView)findViewById(R.id.recyclerHistorial_dos);
        recyclerHistorial_dos.setHasFixedSize(true);
        recyclerHistorial_dos.setLayoutManager(new LinearLayoutManager(getApplicationContext()));

        textView_Hist_DiaTexto  = (TextView)findViewById(R.id.textView_Hist_dia3);
        textView_Hist_dia       = (TextView)findViewById(R.id.textView_Hist_dia);
        textView_Hist_mes       = (TextView)findViewById(R.id.textView_Hist_mes);
        textView_Hist_año       = (TextView)findViewById(R.id.textView_Hist_año);
        txtIngresoTotalHist     = (TextView)findViewById(R.id.txtIngresoTotalHist);

        consVenAccionesPrincipales  = (ConstraintLayout)findViewById(R.id.consVenAccionesPrincipales);


        recyclerSurtir_traslado     = (RecyclerView)findViewById(R.id.recyclerSurtir_traslado);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (sliding.getPanelState() == SlidingUpPanelLayout.PanelState.EXPANDED) {
                    sliding.setPanelState(SlidingUpPanelLayout.PanelState.COLLAPSED);
                } else {
                    // Desactivar este callback para que el evento de retroceso sea manejado por el sistema
                    setEnabled(false);
                    // Invocar el evento de retroceso predeterminado
                    finish(); // O puedes usar finishAffinity() si deseas cerrar la actividad completamente
                }
            }
        });
        try {
            if(jsonVenta.length() > 0){
                llenarCampos();
            }else toast("no hay ventas registradas");
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        //masVendidoIniciarAdapter();
    }

    pop.pop_mensajes pop_mensajes;
    @Override
    public void onClick(View view) {
        if(view.getId() == R.id.button_v1){
            sliding.setPanelState(SlidingUpPanelLayout.PanelState.EXPANDED);
        } else if (view.getId() == R.id.button70Mensaje) {
            String idDispositivo = generales.loadData_sharedPreferences(getApplicationContext(), "id_mensaje","dispositivo");
            if(jsonDatos.has("dispositivos_mensaje") && !idDispositivo.equals("")){
                ((Button)findViewById(R.id.button70Mensaje)).setBackgroundDrawable(getResources().getDrawable(R.drawable.mensaje_blamco));
                saveData_sharedPreferences(getApplicationContext(),"mensaje", "key_cant_mensaje", "");
                TextView textView = (TextView)findViewById(R.id.textView_mensaje);
                textView.setVisibility(View.GONE);
                textView.setText("");
                pop_mensajes = new pop_mensajes();
                pop_mensajes.showPopupWindow(view, "Jesus", idDispositivo);
            }else {
                generales.intent(registro_dispositivo.class, getApplicationContext(), "", "");
            }
        }else if (R.id.recorrerRecycler_venta == view.getId()){
            recyclerHistorial_dos.scrollToPosition(adapterHistorialDos.getItemCount() - 1);
        }

    }

    public void verPedido(String idPedido){
        Intent askIntent = new Intent(this, pedidos.class);
        askIntent.putExtra("idPedido", idPedido);
        someActivityResultLauncher.launch(askIntent);
    }




    ActivityResultLauncher<Intent> someActivityResultLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            new ActivityResultCallback<ActivityResult>() {
                @Override
                public void onActivityResult(ActivityResult result) {
                    if (result.getResultCode() == Activity.RESULT_OK) {
                        // There are no request codes
                        Intent data = result.getData();

                        if(data != null){
                            if(data.hasExtra("verAp"))
                            {

                            }
                        }
                    }
                }
            });


    private void masVendidoIniciarAdapter(){
        /** MAS VENDIDO ESTE DIA **/
        try {
            JSONObject object = new JSONObject();
            JSONArray array = new JSONArray(adapterHistorialDos.getArray().toString());


            for (int i = 0; i < array.length(); i++){

                if(array.getJSONObject(i).has("ultimo_dia_registrado_en_venta")){
                    JSONArray array_artVenta = array.getJSONObject(i).getJSONArray("articulos");
                    for (int x = 0; x < array_artVenta.length(); x++){
                        if (!array_artVenta.getJSONObject(x).has("numeroAp")){
                            array_artVenta.getJSONObject(x).
                                    put("rastro_fecha",
                                            array.getJSONObject(i).getString("id_registro")
                                                    + " " + array.getJSONObject(i).getString("numeroDeVenta"));
                            array_artVenta.getJSONObject(x).
                                    put("rastro_index_adap_1", String.valueOf(i));
                            array_artVenta.getJSONObject(x).
                                    put("rastro_index_adap_2", String.valueOf(x));

                            String hora = array.getJSONObject(i).getString("fecha");
                            hora = hora.split(" ")[3] ;
                            array_artVenta.getJSONObject(x).put("hora", hora);
                            if(object.length() > 0){
                                if(object.has(array_artVenta.getJSONObject(x).getString("id"))){
                                    object.getJSONArray(array_artVenta.getJSONObject(x).getString("id")).put(array_artVenta.getJSONObject(x));
                                }else {
                                    JSONArray array_2 = new JSONArray();
                                    array_2.put(array_artVenta.getJSONObject(x));
                                    object.put(array_artVenta.getJSONObject(x).getString("id"), array_2);
                                }
                            }
                            else {
                                JSONArray array_2 = new JSONArray();
                                array_2.put(array_artVenta.getJSONObject(x));
                                object.put(array_artVenta.getJSONObject(x).getString("id"), array_2);
                            }
                        }
                    }//15 mar. 2024 7:35:59 p. m.
                }
            }
            if(object.length() > 0){
                int[] ordenar = new int[object.names().length()];
                ArrayList<String> arrayList = new ArrayList<>();
                for (int i = 0; i < object.names().length(); i ++){
                    ordenar[i] = object.getJSONArray(object.names().getString(i)).length();
                    arrayList.add(object.names().getString(i));
                }
                Arrays.sort(ordenar);
                int x = ordenar.length-1;
                int y = 0;
                JSONObject object_comp = new JSONObject();
                while (x >= 0){
                    if(ordenar[x] == object.getJSONArray(object.names().getString(y)).length()){
                        x--;
                        object_comp.put(object.names().getString(y), object.getJSONArray(object.names().getString(y)));
                        object.remove(object.names().getString(y));
                        y = 0;
                    }else {
                        y++;
                    }
                }
                TextView txtElem_Asignados = (TextView)findViewById(R.id.textView18);
             /*
                adapVista_surtir_en_venta =
                        new adapVista_surtir_en_venta(
                                object_comp,
                                getApplicationContext(),
                                "vendido",
                                adapterHistorialDos,
                                null);
              */
                RecyclerView recycler_surtir_en_venta = (RecyclerView) findViewById(R.id.recycler_surtir_en_venta);
                generales.recyclerVertical(recycler_surtir_en_venta, getApplicationContext());
                recycler_surtir_en_venta.setAdapter(adapVista_surtir_en_venta);
            }else {
                toast("SOLO APRTADOS, PARA ESTE DÍA");
                adapVista_surtir_en_venta.reset();
            }

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public SlidingUpPanelLayout sliding;


    public void guardarDatos_articulosSurtidos_nube(){
        String fecha = adapterHistorialDos.getIdVenta();
        //documenRef("/ventas/" + año + "/" + mes + "/" + dia).set(map);
        //toast(fecha);
        try {
            documenRef("/ventas/" + fecha).update(
                    new Gson().fromJson(
                            jsonVenta.
                                    getJSONObject(fecha.split("/")[0]).
                                    getJSONObject(fecha.split("/")[1]).
                                    getJSONObject(fecha.split("/")[2]).toString(), HashMap.class));
            toast("DATOS GUARDADOS");
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public void toast(String mensaje) {
        Toast toast = Toast.makeText( getApplicationContext(), mensaje, Toast.LENGTH_LONG);
        toast.setGravity(Gravity.CENTER_HORIZONTAL, 0, 0);
        toast.show();
    }
    String ultimoAño, ultimoMes, ultimoDia;
    private JSONArray jsonArray (){

        try {

            ArrayList<Integer> arrayList = new ArrayList<>();
            for (int i = 0; i < jsonVenta.names().length(); i++){
                arrayList.add(Integer.parseInt(jsonVenta.names().getString(i)));
            }

            Collections.sort(arrayList);

            ultimoAño = String.valueOf(arrayList.get(arrayList.size()-1));
            arrayList = new ArrayList<Integer>();
            for (int i = 0; i < jsonVenta.getJSONObject(ultimoAño).names().length(); i++){
                arrayList.add(Integer.parseInt( jsonVenta.getJSONObject(ultimoAño).names().getString(i)));
            }

            Collections.sort(arrayList);
            ultimoMes = String.valueOf(arrayList.get(arrayList.size()-1));
            arrayList = new ArrayList<Integer>();
            for (int i = 0; i < jsonVenta.getJSONObject(ultimoAño).getJSONObject(ultimoMes).names().length(); i++){
                arrayList.add(Integer.parseInt(jsonVenta.getJSONObject(ultimoAño).getJSONObject(ultimoMes).names().getString(i)));
            }
            Collections.sort(arrayList);
            ultimoDia = String.valueOf(arrayList.get(arrayList.size()-1));

            return new JSONArray(jsonVenta.getJSONObject(ultimoAño).
                    getJSONObject(ultimoMes).
                    getJSONObject(ultimoDia).getJSONArray("registro").toString());
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }



    ///////////////////////////////////////////////////////////////////////////////////////////
 /*
    public void actualizar(JSONArray array, String fecha, String rastroFecha) {
        ganacias(array);
        adapterHistorialDos = new adapter.adapterHistorialDos(
                array ,
                getApplicationContext(),
                sumaSeleccion,
                "",
                this,
                recyclerHistorial_dos,
                rastroFecha,
                null);
        recyclerHistorial_dos.setAdapter(adapterHistorialDos);
        textView_Hist_DiaTexto.setText((fecha.split("ç")[0]).split(" ")[0]);
        textView_Hist_dia.setText((fecha.split("ç")[0]).split(" ")[1]);
        textView_Hist_mes.setText(fecha.split("ç")[1]);
        textView_Hist_año.setText(fecha.split("ç")[2]);
        retInversion   = (TextView)findViewById(R.id.retornoUTL);//textView39
        utilidad       = (TextView)findViewById(R.id.txtviewUTL);//textView39
        masVendidoIniciarAdapter();
    }
  */

    private void ganacias(JSONArray array){
        TextView txtIngresoTotalHist = (TextView)findViewById(R.id.txtIngresoTotalHist);
        TextView retornoUTL = (TextView)findViewById(R.id.retornoUTL);
        TextView txtviewUTL = (TextView)findViewById(R.id.txtviewUTL);

        //cantidad id
        int total = 0, retorno = 0, utl = 0;
        for (int i = 0; i < array.length(); i++){
            try {
                JSONObject obj = array.getJSONObject(i);
                total = total + Integer.parseInt(obj.getString("montoCobro"));//preciCompra

                JSONArray ar = obj.getJSONArray("articulos");
                for (int y = 0; y < ar.length(); y++){
                    JSONObject o = ar.getJSONObject(y);
                    int precioCompra = 0;
                    if(!o.has("nombreAP")) precioCompra = Integer.parseInt(jsonArticulos.getJSONObject(o.getString("id")).getString("preciCompra"));
                    int cantidad     = Integer.parseInt(o.getString("cantidad"));
                    int precioVenta  = Integer.parseInt(o.getString("precio"));
                    retorno = retorno + (precioCompra * cantidad);
                    utl = utl + (precioVenta * cantidad);
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        txtIngresoTotalHist.setText(String.valueOf(total));
        retornoUTL.setText(String.valueOf(retorno));
        txtviewUTL.setText(String.valueOf(utl));
    }
    public void total_(ArrayList<JSONObject> objects){
        int total = 0, precioCompra = 0;
        for (int i = 0; i < objects.size(); i ++){
            if(objects.get(i).has("montoCobro")){
                try {
                    total = total + Integer.parseInt(objects.get(i).getString("montoCobro"));
                } catch (JSONException e) {
                    e.printStackTrace();
                    toast("error");
                }
            } else {
                try {
                    total = total + Integer.parseInt(objects.get(i).getString("montoTotalEfectivo"));
                } catch (JSONException e) {
                    e.printStackTrace();
                }
            }
            try {
                for (int x = 0; x < objects.get(i).getJSONArray("idProducto").length(); x++){

                    if(!objects.get(i).getJSONArray("idProducto").getString(x).split("ç")[0].equals("00000000")){
                        precioCompra = precioCompra +
                                Integer.parseInt(objects.get(i).getJSONArray("idProducto").getString(x).split("ç")[7])
                                        *
                                        Integer.parseInt(objects.get(i).getJSONArray("idProducto").getString(x).split("ç")[1]);
                    } else {
                        precioCompra = precioCompra +
                                Math.round(
                                        (((float)((Integer.parseInt(objects.get(i).getJSONArray("idProducto").getString(x).split("ç")[1])
                                                *
                                                Integer.parseInt(objects.get(i).getJSONArray("idProducto").getString(x).split("ç")[2])))) / 2));
                    }

                }
            } catch (JSONException e) {
                e.printStackTrace();
            }
        }
        retInversion.setText(String.valueOf(precioCompra));
        utilidad.setText(String.valueOf(total-precioCompra));

        String venta = String.valueOf(total);

        if(venta.length() > 5) {//   $ 12,3456  $ 1,234
            venta = venta.substring(0,3) + "," + venta.substring(3);
        } else if(venta.length() > 4) {//   $ 12,3456  $ 1,234
            venta = venta.substring(0,2) + "," + venta.substring(2);
        } else if(venta.length() > 3){
            venta = venta.substring(0,1) + "," + venta.substring(1);
        }

        txtIngresoTotalHist.setText(venta);
    }

    /////////////////////////////////////////////////////////////////////////////////////////
    public JSONObject mapToJSON(Map<String, Object> map) throws JSONException {
        JSONObject obj_ = new JSONObject();
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            if (value instanceof Map) {
                Map<String, Object> subMap = (Map<String, Object>) value;
                obj_.put(key, mapToJSON(subMap));
            } else if (value instanceof List) {
                obj_.put(key, listToJSONArray((List) value));
            }
            else {
                obj_.put(key, value);
            }
        }
        return obj_;
    }
    private JSONArray listToJSONArray(List<Object> list) throws JSONException {
        JSONArray arr = new JSONArray();

        for(Object obj: list) {
            if (obj instanceof Map) {
                arr.put(mapToJSON((Map) obj));
            }
            else if(obj instanceof List) {
                arr.put(listToJSONArray((List) obj));
            }
            else {
                arr.put(obj);
            }
        }
        return arr;
    }
    public static String menos_c(String s){// 10 6
        if(s.charAt(0) == '0'){
            s = s.substring(1);
        }
        return s;
    }
    public static String numeroAmes(String s){
        String a = "";
        switch (s){
            case "1":
                a = "Enero";
                break;
            case "2":
                a = "Febrero";
                break;
            case "3":
                a = "Marzo";
                break;
            case "4":
                a = "Abril";
                break;
            case "5":
                a = "Mayo";
                break;
            case "6":
                a = "Junio";
                break;
            case "7":
                a = "Julio";
                break;
            case "8":
                a = "Agosto";
                break;
            case "9":
                a = "Septiembre";
                break;
            case "10":
                a = "Otubre";
                break;
            case "11":
                a = "Noviembre";
                break;
            case "12":
                a = "Diciembre";
                break;
        }
        return a;
    }



}