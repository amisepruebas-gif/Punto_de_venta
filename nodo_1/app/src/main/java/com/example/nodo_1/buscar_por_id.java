package com.example.nodo_1;

import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonArticulos;
import static com.example.nodo_1.principal.jsonPedido;
import static com.example.nodo_1.principal.jsonVenta;
import static com.example.nodo_1.principal.jsonVentaXarticulo;
import static com.example.nodo_1.principal.objectFechasVenta;

import static generales_1.recursos_1.photoBarcode;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.viewpager.widget.ViewPager;

import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;
import com.sothree.slidinguppanel.SlidingUpPanelLayout;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Objects;

import adapter.Model;
import adapter.adapterBusquedaPorID_1;
import adapter.adapterHistorialDos;
import adapterModel_package.adap_model_fecha_venta_articulo;


public class buscar_por_id extends Fragment implements View.OnClickListener {


    TextView elemtosEncontrados;
    AutoCompleteTextView autoCompleteTextView;
    RecyclerView recyclerView;
    ViewPager viewPager;
    List<Model> models;
    SlidingUpPanelLayout sliding;
    View view;
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {

        view =  inflater.inflate(R.layout.buscar_por_id, container, false);


        sliding = (SlidingUpPanelLayout) view.findViewById(R.id.sliding_art_por_id);


        autoCompleteTextView = (AutoCompleteTextView)view.findViewById(R.id.autoCompleteBusqedaAgrgarCliente);
        actualizarAutocomplete();




        recyclerView = (RecyclerView)view.findViewById(R.id.recycler_busquedaID_1);
        generales.recyclerVertical(recyclerView, view.getContext());
        elemtosEncontrados = (TextView)view.findViewById(R.id.elemebtosEncontradosTextView);
        elemtosEncontrados.setText("INGRESE UN ID");


        /*
        Intent intent = getIntent();
        if (intent != null) {
            if(intent.hasExtra("idArt")){
                String idArt = intent.getStringExtra("idArt"); // Asegúrate de proveer un valor por defecto
                buscarArticuloOptimizado(recyclerView, idArt);
            }
        }
         */

        autoCompleteTextView.setOnTouchListener((v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_UP) {
                // Verifica si el clic fue en el drawable de la derecha
                if (event.getRawX() >= (autoCompleteTextView.getRight() - autoCompleteTextView.getCompoundDrawables()[2].getBounds().width())) {
                    photoBarcode(requireActivity());
                    return true;
                }
            }
            return false;
        });

       /*
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
        */
        return view;
    }

    /*
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        // Procesa el resultado del escaneo
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result != null) {
            if (result.getContents() == null) {
                toast("CANCELADO", view.getContext());
            } else {
                // Código escaneado
                String codigoEscaneado = result.getContents();
                autoCompleteTextView.setText(codigoEscaneado);
                buscar_getTrxtAutocomplete(autoCompleteTextView);
                // Aquí puedes manejar el código escaneado, por ejemplo, almacenarlo o procesarlo
            }
        }
    }
     */
    private void buscarArticuloOptimizado(RecyclerView recyclerView, String id) {
        if (objectFechasVenta.length() > 0) {
            JSONArray ventasEncontradas = new JSONArray();
            List<Model> modelos = new ArrayList<>();
            int totalMeses = 0;

            try {
                JSONObject objVenta = objectFechasVenta;
                List<Integer> listaAnios = obtenerListaOrdenadaDeClaves(objVenta);

                for (Integer anio : listaAnios) {
                    JSONObject objMeses = objVenta.getJSONObject(String.valueOf(anio));
                    List<Integer> listaMeses = obtenerListaOrdenadaDeClaves(objMeses);

                    for (Integer mes : listaMeses) {
                        totalMeses++;

                        ArrayList<String> diasEncontrados = new ArrayList<>();
                        ArrayList<String> listaVacia = new ArrayList<>();

                        JSONObject objDias = objMeses.getJSONObject(String.valueOf(mes));
                        List<Integer> listaDias = obtenerListaOrdenadaDeClaves(objDias);

                        boolean mesEncontrado = false;
                        JSONObject cantidadVendidaPorDia = new JSONObject();

                        for (Integer dia : listaDias) {
                            int cantidadVendida = 0;
                            boolean diaEncontrado = false;

                            if (jsonVenta.has(String.valueOf(anio))) {
                                JSONObject ventasAnio = jsonVenta.getJSONObject(String.valueOf(anio));

                                if (ventasAnio.has(String.valueOf(mes))) {
                                    JSONObject ventasMes = ventasAnio.getJSONObject(String.valueOf(mes));

                                    if (ventasMes.has(String.valueOf(dia))) {
                                        JSONArray registrosVenta = ventasMes.getJSONObject(String.valueOf(dia)).getJSONArray("registro");

                                        for (int i = 0; i < registrosVenta.length(); i++) {
                                            boolean articuloEncontrado = false;
                                            JSONArray articulos = registrosVenta.getJSONObject(i).getJSONArray("articulos");

                                            for (int j = 0; j < articulos.length(); j++) {
                                                JSONObject articulo = articulos.getJSONObject(j);

                                                if (id.equals(articulo.optString("id"))) {
                                                    articuloEncontrado = true;
                                                    diaEncontrado = true;
                                                    mesEncontrado = true;
                                                    cantidadVendida++;
                                                    int cantVendida_reg = Integer.parseInt(articulo.getString("cantidad"));
                                                    if (cantVendida_reg > 0){
                                                        cantidadVendida = cantidadVendida + cantVendida_reg - 1;
                                                    }
                                                } else if (articulo.has("numeroAp")) {
                                                    JSONArray array = jsonPedido.getJSONObject(articulo.getString("numeroAp")).getJSONArray("articulos");
                                                    for (int k = 0; k < array.length(); k++){
                                                        if(array.getJSONObject(k).getString("id").equals(id)){
                                                            articuloEncontrado = true;
                                                            diaEncontrado = true;
                                                            mesEncontrado = true;
                                                            cantidadVendida++;
                                                            int cantVendida_reg = Integer.parseInt(articulo.getString("cantidad"));
                                                            if (cantVendida_reg > 0){
                                                                cantidadVendida = cantidadVendida + cantVendida_reg - 1;
                                                            }
                                                        }
                                                    }
                                                }
                                            }

                                            if (articuloEncontrado) {
                                                ventasEncontradas.put(registrosVenta.getJSONObject(i));
                                            }
                                        }
                                    }
                                }
                            }

                            if (diaEncontrado) {
                                diasEncontrados.add(String.valueOf(dia));
                                listaVacia.add("0");
                                cantidadVendidaPorDia.put(String.valueOf(dia), String.valueOf(cantidadVendida));
                            }
                        }

                        if (mesEncontrado) {
                            modelos.add(new Model(
                                    R.drawable.icon_png_amise_v,
                                    String.format("%d %d", mes, anio),
                                    diasEncontrados,
                                    null,
                                    String.valueOf(mes),
                                    listaVacia,
                                    cantidadVendidaPorDia
                            ));
                        }
                    }
                }
            } catch (JSONException e) {
                e.printStackTrace();
                toast("error", view.getContext());
            }

            if (ventasEncontradas.length() > 0) {
                adapterHistorialDos adapter = new adapterHistorialDos(
                        ventasEncontradas,
                        view.getContext(),
                        view.findViewById(R.id.elemebtosEncontradosTextView),
                        id,
                        null,
                        recyclerView,
                        "ultimoAño ultimoMes ultimoDia"
                );
                recyclerView.setAdapter(adapter);

                adap_model_fecha_venta_articulo adapterModel = new adap_model_fecha_venta_articulo(
                        modelos,
                        view.getContext(),
                        null
                );

                ViewPager viewPager = view.findViewById(R.id.viewPager);
                viewPager.setAdapter(adapterModel);
                viewPager.setPadding(0, 0, 0, 0);
                viewPager.setCurrentItem(totalMeses - 1);
                int pageMargin = getResources().getDimensionPixelSize(R.dimen.page_margin);
                viewPager.setPageMargin(pageMargin);
                viewPager.addOnPageChangeListener(new ViewPager.OnPageChangeListener() {
                    @Override
                    public void onPageScrolled(int position, float positionOffset, int positionOffsetPixels) {
                        // Implementación si es necesaria
                    }

                    @Override
                    public void onPageSelected(int position) {
                        // Implementación si es necesaria
                    }

                    @Override
                    public void onPageScrollStateChanged(int state) {
                        // Implementación si es necesaria
                    }
                });
            }
        } else {
            toast("vacio", view.getContext());
        }
    }

    private List<Integer> obtenerListaOrdenadaDeClaves(JSONObject jsonObject) throws JSONException {
        List<Integer> claves = new ArrayList<>();
        JSONArray nombres = jsonObject.names();

        for (int i = 0; i < nombres.length(); i++) {
            claves.add(Integer.parseInt(nombres.getString(i)));
        }

        Collections.sort(claves);
        return claves;
    }



    public static JSONArray ordenarFechas(JSONArray fechasArray) throws JSONException, ParseException {
        // Lista para almacenar las fechas
        List<Date> fechasList = new ArrayList<>();

        // Formato de fecha de entrada
        SimpleDateFormat sdfEntrada = new SimpleDateFormat("yyyy-MM-dd");

        // Formato de fecha de salida sin ceros a la izquierda
        SimpleDateFormat sdfSalida = new SimpleDateFormat("yyyy-M-d");

        // Extraer y parsear las fechas del JSONArray
        for (int i = 0; i < fechasArray.length(); i++) {
            String fechaStr = fechasArray.getString(i);
            Date fecha = sdfEntrada.parse(fechaStr);
            fechasList.add(fecha);
        }

        // Ordenar la lista en orden descendente (de mayor a menor)
        Collections.sort(fechasList, new Comparator<Date>() {
            @Override
            public int compare(Date d1, Date d2) {
                return d2.compareTo(d1); // Orden descendente
            }
        });

        // Crear un nuevo JSONArray con las fechas ordenadas y sin ceros a la izquierda
        JSONArray fechasOrdenadas = new JSONArray();
        for (Date fecha : fechasList) {
            String fechaFormateada = sdfSalida.format(fecha);
            fechasOrdenadas.put(fechaFormateada);
        }

        return fechasOrdenadas;
    }
    public void actualizarAutocomplete(){

        ArrayList<String> arrayList = new ArrayList<>();
        for (int i = 0 ;i < jsonArticulos.names().length(); i++){
            String id = "";
            try {
                id = jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("id");
                if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has("sigla")){
                    id = jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("sigla") + " " + id;
                }
                arrayList.add(id);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }

        }
        autoCompleteTextView.setAdapter(new ArrayAdapter<String>(view.getContext(), android.R.layout.simple_list_item_1, arrayList));
        selecItem_autoComplete_codigoArt(autoCompleteTextView);
    }
    public void selecItem_autoComplete_codigoArt(AutoCompleteTextView autoComplete_codigoArt){
        autoComplete_codigoArt.setSingleLine();
        autoComplete_codigoArt.setOnKeyListener(new View.OnKeyListener() {
            @Override
            public boolean onKey(View v, int keyCode, KeyEvent event) {
                if ((event.getAction() == KeyEvent.ACTION_DOWN) && (keyCode == KeyEvent.KEYCODE_ENTER)) {
                    if(autoComplete_codigoArt.length() > 0){
                        buscar_getTrxtAutocomplete(autoComplete_codigoArt);
                    }
                }
                return (keyCode == KeyEvent.KEYCODE_ENTER);
            }
        });
        autoComplete_codigoArt.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int i, long l) {
                if(autoComplete_codigoArt.length() > 0){
                    buscar_getTrxtAutocomplete(autoComplete_codigoArt);
                }
            }
        });
    }
    private void buscar_getTrxtAutocomplete(AutoCompleteTextView autoCompleteTextView){
        String cadena = autoCompleteTextView.getText().toString();
        if(cadena.contains(" ")){
            cadena = cadena.split(" ")[1];
        }
        if(jsonArticulos.has(cadena)){
            buscarArticuloOptimizado(recyclerView, cadena);
        }else toast("ARTICULO NO ENCONTRADO", view.getContext() );
    }

    @Override
    public void onClick(View view) {
        if(R.id.button10 == view.getId()){
            sliding.setPanelState(SlidingUpPanelLayout.PanelState.EXPANDED);
        }
    }
}
