package com.example.nodo_1;

import static com.example.nodo_1.generales.initPantalla_barra_blanca_texto_negro;
import static com.example.nodo_1.principal.jsonCorteHistorial;
import static modulos_descarga.corte.obtenerFechaMasReciente;

import android.os.Bundle;
import android.view.View;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.RecyclerView;
import androidx.viewpager.widget.ViewPager;

import com.sothree.slidinguppanel.SlidingUpPanelLayout;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

import adapter.Model;
import adapterModel_package.adapaterMode_corte;

public class corte_hist extends AppCompatActivity implements View.OnClickListener {
    ViewPager viewPager;
    List<Model> models;
    adapterModel_package.adapaterMode_corte adapterModel;
    SlidingUpPanelLayout sliding;
    adapter.adap_corte_1 adap_corte_1;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.corte_hist);
        initPantalla_barra_blanca_texto_negro(getWindow(), getApplicationContext());
        if(jsonCorteHistorial.length() > 0){
            sliding = (SlidingUpPanelLayout) findViewById(R.id.sliding_corte);

            RecyclerView recycler_corte = (RecyclerView)findViewById(R.id.recycler_corte);
            generales.recyclerVertical(recycler_corte, getApplicationContext());
            adap_corte_1 = new adapter.adap_corte_1(getApplicationContext());
            recycler_corte.setAdapter(adap_corte_1);

            String fechainicioString = obtenerFechaMasReciente(jsonCorteHistorial);

            adap_corte_1.actualizar(initArray(fechainicioString));

            initViewPager();

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
    }

    @Override
    public void onClick(View view) {
        if (R.id.but_calendar_corte == view.getId()){
            sliding.setPanelState(SlidingUpPanelLayout.PanelState.EXPANDED);
        }
    }

    static public JSONArray initArray(String fechainicioString){
        String año = fechainicioString.split("-")[0];
        String mes = fechainicioString.split("-")[1];
        String dia = fechainicioString.split("-")[2];

        JSONArray  array   = adapterModel_package.adapaterMode_corte.obtenerRegistroPorFecha(año, mes, dia);
        JSONObject object = new JSONObject();
        JSONArray  setArray = new JSONArray();
        try {
            for (int i = 0; i < array.length(); i++){
                JSONObject object_1 = array.getJSONObject(i).getJSONObject(array.getJSONObject(i).names().getString(0));
                String huella = object_1.getString("huella");
                if (object.length() == 0){
                    JSONObject object_2 = new JSONObject();
                    if (object_1.getString("estado").equals("corte_iniciar")){
                        object_2.put("1", object_1);
                    }else {
                        object_2.put("2", object_1);
                    }
                    object.put(huella, object_2);
                }else {
                    if(object.has(huella)){
                        JSONObject object_3 = new JSONObject();
                        object_3.put("2", object_1);
                        object_3.put("1", object.getJSONObject(huella).getJSONObject("1"));
                        object.put(huella, object_3);
                    }else {
                        JSONObject object_2 = new JSONObject();
                        object_2.put("1", object_1);
                        object.put(huella, object_2);
                    }
                }
            }
            for (int i = 0; i < object.names().length(); i++){
                setArray.put(object.getJSONObject(object.names().getString(i)));
            }
            return  setArray;
        }catch (JSONException e){
            return  null;
        }
    }


    private void initViewPager(){
        models = new ArrayList<>();
        int cantidadMeses = 0;
        for(int i = 0; i < jsonCorteHistorial.names().length(); i++){
            try {
                JSONObject objectMes = jsonCorteHistorial.getJSONObject(jsonCorteHistorial.names().getString(i));
                for (int x = 0; x < objectMes.names().length(); x++){
                    cantidadMeses++;
                    JSONObject objectDias = objectMes.getJSONObject(objectMes.names().getString(x));
                    ArrayList<String> cadenaIdBt = new ArrayList<>();
                    ArrayList<String> list = new ArrayList<>();
                    for (int y = 0; y < objectDias.names().length(); y++){
                        cadenaIdBt.add(objectDias.names().getString(y));
                        list.add("0");
                    }
                    models.add(
                            new Model(
                                    R.drawable.icon_png_amise_v,
                                    objectMes.names().getString(x)+ " " + jsonCorteHistorial.names().getString(i),
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
                adapaterMode_corte(
                models,
                getApplicationContext(),
                adap_corte_1
                );

        viewPager = findViewById(R.id.viewPager);

        viewPager.setAdapter(adapterModel);
        viewPager.setPadding(0, 0, 0, 0);
        viewPager.setCurrentItem(cantidadMeses-1);
        int pageMargin = getResources().getDimensionPixelSize(R.dimen.page_margin);
        viewPager.setPageMargin(pageMargin);
        viewPager.addOnPageChangeListener(new ViewPager.OnPageChangeListener() {
            @Override
            public void onPageScrolled(int position, float positionOffset, int positionOffsetPixels) {

            }

            @Override
            public void onPageSelected(int position) {

            }

            @Override
            public void onPageScrollStateChanged(int state) {

            }
        });
    }
}
/*
     if(object.getString("estado").equals(getString(R.string.corte_iniciar))){

                        } else if (object.getString("estado").equals(getString(R.string.corte_terminado))){

                        } else if (object.getString("estado").equals(getString(R.string.corte_enCurso))){

                        }
 */