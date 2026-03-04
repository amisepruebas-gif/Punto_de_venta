package fragmentVenta;

import static com.example.nodo_1.principal.jsonVenta;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.viewpager.widget.ViewPager;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;
import com.sothree.slidinguppanel.SlidingUpPanelLayout;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import adapter.Model;
import adapter.adapVista_surtir_en_venta;

public class venta_clase extends AppCompatActivity implements View.OnClickListener {

    public SlidingUpPanelLayout         sliding;
    RecyclerView                        recyclerHistorial_dos;
    adapter.adapterHistorialDos         adapterHistorialDos;
    List<Model>                         models;
    adapter.adapterModel                adapterModel;
    ViewPager                           viewPager;
    adapter.adapVista_surtir_en_venta   adapVista_surtir_en_venta = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.vista_venta_v2);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

        sliding                 = (SlidingUpPanelLayout) findViewById(R.id.panelStateVentaPorFecha);
        recyclerHistorial_dos   = (RecyclerView)findViewById(R.id.recyclerHistorial_dos);
        recyclerHistorial_dos.setHasFixedSize(true);
        recyclerHistorial_dos.setLayoutManager(new LinearLayoutManager(getApplicationContext()));

        LinearLayoutManager layoutManager;
        layoutManager = (LinearLayoutManager) recyclerHistorial_dos.getLayoutManager();
        recyclerHistorial_dos.addOnScrollListener(new RecyclerView.OnScrollListener() {
            @Override
            public void onScrolled(@NonNull RecyclerView recyclerView, int dx, int dy) {
                super.onScrolled(recyclerView, dx, dy);
                int firstVisibleItem = layoutManager.findFirstVisibleItemPosition();
                int lastVisibleItem = layoutManager.findLastVisibleItemPosition();

                if (adapterHistorialDos.getItemCount()-1 >= firstVisibleItem && adapterHistorialDos.getItemCount()-1 <= lastVisibleItem) {
                    //((Button)view.findViewById(R.id.recorrerRecycler_venta)).setVisibility(View.GONE);
                } else {
                    //((Button)view.findViewById(R.id.recorrerRecycler_venta)).setVisibility(View.VISIBLE);
                }
            }
        });

        onBak_pressed();

        try {
            if(jsonVenta.length() > 0){
                llenarCampos();
            }else toast("no hay ventas registradas");
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

        ((Button)findViewById(R.id.button38)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                sliding.setPanelState(SlidingUpPanelLayout.PanelState.EXPANDED);
            }
        });
    }

    private void llenarCampos() throws JSONException {

        JSONArray array = jsonArray();
     /*
        TextView diaNumero = (TextView)view.findViewById(R.id.textView_Hist_dia);
        TextView diaNombre = (TextView)view.findViewById(R.id.textView_Hist_dia3);
        TextView mesNombre = (TextView)view.findViewById(R.id.textView_Hist_mes);
        TextView añoNombre = (TextView)view.findViewById(R.id.textView_Hist_año);

        diaNombre.setText(array.getJSONObject(0).getString("dia"));
        mesNombre.setText(numeroAmes(array.getJSONObject(0).getString("idVenta").split(" ")[1]));
        añoNombre.setText(array.getJSONObject(0).getString("idVenta").split(" ")[0]);
        diaNumero.setText(array.getJSONObject(0).getString("idVenta").split(" ")[2]);
      */

        adapterHistorialDos = new adapter.adapterHistorialDos(
                array,
                getApplicationContext(),
                null,
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
                adapter.adapterModel(
                models,
                getApplicationContext(),
                null);

        viewPager = findViewById(R.id.viewPager);

        viewPager.setAdapter(adapterModel);
        viewPager.setPadding(0, 0, 0, 0);
        int pageMargin = getResources().getDimensionPixelSize(R.dimen.page_margin);
        viewPager.setPageMargin(pageMargin);
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

        //masVendidoIniciarAdapter();
    }

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
                adapVista_surtir_en_venta =
                        new adapVista_surtir_en_venta(
                                object_comp,
                                getApplicationContext(),
                                "vendido",
                                adapterHistorialDos);
                RecyclerView recycler_surtir_en_venta = (RecyclerView) findViewById(R.id.recycler_surtir_en_venta);
                generales.recyclerVertical(recycler_surtir_en_venta, getApplicationContext());
                recycler_surtir_en_venta.setAdapter(adapVista_surtir_en_venta);
            }else {
                toast("SOLO APRTADOS, PARA ESTE DÍA");
                if(adapVista_surtir_en_venta!=null) adapVista_surtir_en_venta.reset();
            }

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public void actualizar(JSONArray array, String fecha, String rastroFecha) {
        //ganacias(array);
        adapterHistorialDos = new adapter.adapterHistorialDos(
                array ,
                getApplicationContext(),
                null,
                "",
                null,
                recyclerHistorial_dos,
                rastroFecha);
        recyclerHistorial_dos.setAdapter(adapterHistorialDos);
        masVendidoIniciarAdapter();
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

            return new JSONArray(
                    jsonVenta.
                            getJSONObject(ultimoAño).
                            getJSONObject(ultimoMes).
                            getJSONObject(ultimoDia).getJSONArray("registro").toString());
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    private void onBak_pressed(){
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
    }

    private void toast(String s){
        generales.toast(s, getApplicationContext());
    }
    @Override
    public void onClick(View view) {


    }
}