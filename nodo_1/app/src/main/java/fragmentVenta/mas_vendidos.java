package fragmentVenta;

import static com.example.nodo_1.principal.jsonArticulos;
import static com.example.nodo_1.principal.jsonVenta;
import static com.example.nodo_1.principal.jsonVentaXarticulo;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.buscar_por_id;
import com.example.nodo_1.generales;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import adapter.adapMasvendidos;

public class mas_vendidos extends Fragment {
    Fragment selectedFragment;
    mas_vendidos(Fragment selectedFragment){
        this.selectedFragment = selectedFragment;
    }

    adapter.adapMasvendidos adapMasvendidos;
    static int numeroDiasVendidos = 0;
    View                          view;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        view =  inflater.inflate(R.layout.mas_vendidos, container, false);


        TextView diasIndicador  = (TextView)view.findViewById(R.id.ventaDias_txt_indicador);
        TextView textView       = (TextView)view.findViewById(R.id.diasReg_m_v_);

        if(jsonVentaXarticulo.length() > 0 && jsonArticulos.length() > 0 && jsonVenta.length() > 0){
            EditText editText       = (EditText)view.findViewById(R.id.editMasVendido);
            Button   button         = (Button)  view.findViewById(R.id.but_masVendido_activity_principal);

            //  item_id fecha
            JSONArray array = new JSONArray();
            JSONObject obj = jsonVentaXarticulo;
            for (int i = 0; i < obj.names().length(); i++){
                try {
                    JSONObject o = obj.getJSONObject(obj.names().getString(i));
                    for (int x = 0; x <  o.names().length(); x++){
                        JSONObject object = new JSONObject();
                        object.put("item_id", obj.names().getString(i));
                        object.put("fecha",
                                fechaFormat(
                                        o.names().getString(x).split("-")[0],
                                        o.names().getString(x).split("-")[1],
                                        o.names().getString(x).split("-")[2]));
                        for (int c = 0; c < o.getJSONObject(o.names().getString(x)).getJSONArray("index").length(); c++){
                            array.put(object);
                        }
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }

            }
            RecyclerView recyclerView = (RecyclerView)view.findViewById(R.id.recyclerMasVendidos);
            generales.recyclerVertical(recyclerView, view.getContext());


            int dias = 0;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                dias = contarFechasUnicas(array);
            }
            textView.setText(String.valueOf(dias));

            numeroDiasVendidos = dias;

            if(dias > 30){
                dias = 30;
            }
            diasIndicador.setText(String.valueOf(dias));

            try {
                try {
                    analizarDatos(dias, array);
                } catch (ParseException e) {
                    throw new RuntimeException(e);
                }
                adapMasvendidos = new adapMasvendidos(object.getJSONArray("array"), this);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
            recyclerView.setAdapter(adapMasvendidos);

            button.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    if(editText.length() > 0){
                        if(!editText.getText().toString().equals("0")){
                            if(Integer.valueOf(editText.getText().toString()) <= numeroDiasVendidos){
                                object = new JSONObject();
                                try {
                                    try {
                                        analizarDatos(Integer.parseInt(editText.getText().toString()), array);
                                    } catch (ParseException e) {
                                        throw new RuntimeException(e);
                                    }
                                    diasIndicador.setText(editText.getText().toString());
                                    adapMasvendidos = new adapMasvendidos(object.getJSONArray("array"), mas_vendidos.this);
                                    recyclerView.setAdapter(adapMasvendidos);
                                } catch (JSONException e) {
                                    throw new RuntimeException(e);
                                }
                            }else {
                                toast("NO HAY VENTAS REGISTRADAS");
                            }
                        }
                    }
                }
            });
        }else {
            diasIndicador.setText("0");
            textView     .setText("0");
            toast("NO HAY VENTAS REGISTRADAS");
        }
        return view;
    }


    static public String fechaFormat(String año, String mes, String dia){
        LocalDate fecha = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            fecha = LocalDate.of(Integer.parseInt(año), Integer.parseInt(mes), Integer.parseInt(dia));
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
            return fecha.format(formatter);
        }else return "";
    }
    @RequiresApi(api = Build.VERSION_CODES.O)
    public static int contarFechasUnicas(JSONArray ventasArray) {
        if (ventasArray == null || ventasArray.length() == 0) {
            // No hay fechas para contar
            return 0;
        }

        DateTimeFormatter formatter = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        }
        Set<LocalDate> fechasUnicas = new HashSet<>();

        for (int i = 0; i < ventasArray.length(); i++) {
            try {
                JSONObject venta = ventasArray.getJSONObject(i);
                String fechaStr = venta.getString("fecha");
                LocalDate fechaVenta = LocalDate.parse(fechaStr, formatter);
                fechasUnicas.add(fechaVenta);
            } catch (JSONException e) {
                System.err.println("Error al analizar JSON: " + e.getMessage());
            } catch (DateTimeParseException e) {
                System.err.println("Error al analizar la fecha: " + e.getMessage());
            }
        }

        // Devolver el número de fechas únicas
        return fechasUnicas.size();
    }
    public void verPorID(String idArt){
        selectedFragment = new buscar_por_id();
        requireActivity().getSupportFragmentManager().beginTransaction().replace(R.id.fragment_container,
                selectedFragment).commit();
    }

    JSONObject object = new JSONObject();
    private JSONObject analizarDatos(int dias, JSONArray jsonArray) throws JSONException, ParseException {


        // Mapear fechas a sus items
        Map<String, List<String>> fechaItemMap = new HashMap<>();
        // Lista para almacenar fechas únicas
        Set<String> fechasSet = new HashSet<>();

        for (int i = 0; i < jsonArray.length(); i++) {
            JSONObject obj = jsonArray.getJSONObject(i);
            String fecha = obj.getString("fecha");
            String itemId = obj.getString("item_id");

            fechasSet.add(fecha);

            if (!fechaItemMap.containsKey(fecha)) {
                fechaItemMap.put(fecha, new ArrayList<>());
            }
            fechaItemMap.get(fecha).add(itemId);
        }

        // Ordenar las fechas de más reciente a más antigua
        List<String> fechasOrdenadas = new ArrayList<>(fechasSet);
        Collections.sort(fechasOrdenadas, new Comparator<String>() {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
            @Override
            public int compare(String o1, String o2) {
                try {
                    Date date1 = sdf.parse(o1);
                    Date date2 = sdf.parse(o2);
                    return date2.compareTo(date1); // Orden descendente
                } catch (ParseException e) {
                    e.printStackTrace();
                    return 0;
                }
            }
        });

        // Verificar si hay suficientes fechas
        if (dias > fechasOrdenadas.size()) {
            toast("Aún no hay fechas disponibles para la cantidad asignada al parámetro de entrada.");
        }

        // Tomar las n fechas más recientes
        List<String> fechasSeleccionadas = fechasOrdenadas.subList(0, dias);

        // Mapear item_id a su cantidad total
        Map<String, Integer> itemCantidadMap = new HashMap<>();

        // Recopilar resultados por fecha
        StringBuilder resultadosBuilder = new StringBuilder();

        JSONArray arrayFecha = new JSONArray();
        for (String fecha : fechasSeleccionadas) {
            List<String> items = fechaItemMap.get(fecha);

            // Contar ocurrencias de cada item_id en la fecha actual
            Map<String, Integer> itemCountInDate = new HashMap<>();
            for (String itemId : items) {
                itemCountInDate.put(itemId, itemCountInDate.getOrDefault(itemId, 0) + 1);
                // Actualizar cantidad total
                itemCantidadMap.put(itemId, itemCantidadMap.getOrDefault(itemId, 0) + 1);
            }

            // Construir resultado para la fecha actual
            resultadosBuilder.append("Fecha: ").append(fecha).append("\n");
            for (Map.Entry<String, Integer> entry : itemCountInDate.entrySet()) {
                resultadosBuilder.append(" - item_id: ").append(entry.getKey())
                        .append(", cantidad: ").append(entry.getValue()).append("\n");
            }
            arrayFecha.put(fecha);
            resultadosBuilder.append("\n");
        }

        object.put("arrayFecha", arrayFecha);
        // Ordenar item_id por cantidad total de mayor a menor
        List<Map.Entry<String, Integer>> listaItems = new ArrayList<>(itemCantidadMap.entrySet());
        Collections.sort(listaItems, new Comparator<Map.Entry<String, Integer>>() {
            @Override
            public int compare(Map.Entry<String, Integer> e1, Map.Entry<String, Integer> e2) {
                return e2.getValue().compareTo(e1.getValue()); // Orden descendente
            }
        });

        JSONArray array = new JSONArray();
        // Construir resultado de items ordenados
        resultadosBuilder.append("Items ordenados por cantidad total:\n");
        for (Map.Entry<String, Integer> entry : listaItems) {
            resultadosBuilder.append(" - item_id: ").append(entry.getKey())
                    .append(", cantidad total: ").append(entry.getValue()).append("\n");
            JSONObject jsonObject = new JSONObject();
            jsonObject.put("id", entry.getKey());
            jsonObject.put("cantidad", entry.getValue());
            array.put(jsonObject);
        }

        object.put("array", array);
        return object;
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
                            if(data.hasExtra("verRegPorId_mas_vendidos"))
                            {

                            }
                        }
                    }
                }
            });

    private void toast(String s){
        generales.toast(s, view.getContext());
    }

}