package com.example.nodo_1;

import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonArticulos;
import static com.example.nodo_1.principal.jsonClientes;
import static com.example.nodo_1.principal.jsonPedido;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.EditText;
import android.widget.Spinner;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.Random;
import java.util.TimeZone;

import adapter.adapRegVenta;
import pop.popConfirmarSimpleBotonUno;
import pop.popVariacion_venta;

public class pedidosAgregarReg extends AppCompatActivity implements View.OnClickListener {

    AutoCompleteTextView autoComplete_id;

    private String                          id_bund = null;
    private RecyclerView                    recyclerConsultarExistencia;
    private EditText                        editTextTotal;
    private int                             billete = 0;
    private Spinner                         spinnerDiasPlazo;
    private boolean                         nuevoReg_actualizacion = false;
    adapter.adapRegVenta                    adapRegVenta;
    ConstraintLayout                        consAgregarPrimerArt;

    String idClienteExistente = "";

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        super.onCreate(savedInstanceState);
        setContentView(R.layout.agregar_registro_apartado_cliente);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

        spinnerDiasPlazo = (Spinner)findViewById(R.id.spinnerDiasPlazo);
        autoComplete_id = (AutoCompleteTextView)findViewById(R.id.autoCompleteBusqedaAgrgarCliente);
        recyclerConsultarExistencia = (RecyclerView)findViewById(R.id.recyclerConsultarExistencia);
        editTextTotal = ((EditText)findViewById(R.id.editTextTotal));
        consAgregarPrimerArt = (ConstraintLayout)findViewById(R.id.consAgregueUnArticulo);
        TextView mitadAnticipo = (TextView)findViewById(R.id.mitadAnticipo);

        ((TextView)findViewById(R.id.editTextFecha)).setText(DateFormat.getDateTimeInstance().format(new Date()));

        ArrayList<String> dias_plazo = new ArrayList();
        for (int i = 1; i <= 100; i++){dias_plazo.add(String.valueOf(i));}
        spinnerDiasPlazo.setAdapter(new ArrayAdapter<String>(getApplicationContext(), android.R.layout.simple_list_item_1, dias_plazo));

        generales.recyclerVertical(recyclerConsultarExistencia, getApplicationContext());

        spinnerDiasPlazo.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> adapterView, View view, int i, long l) {
                ((TextView)findViewById(R.id.editTextFechaTermina_)).setText(fecha_((spinnerDiasPlazo.getSelectedItemPosition() + 1), nuevoReg_actualizacion));
            }
            @Override
            public void onNothingSelected(AdapterView<?> adapterView) {

            }
        });


        RecyclerView recyclerItemsVenta =  (RecyclerView)findViewById(R.id.recyclerConsultarExistencia);
        generales.recyclerVertical(recyclerItemsVenta, getApplicationContext());
        adapRegVenta = new adapRegVenta(
                getApplicationContext(),
                recyclerItemsVenta,
                editTextTotal,
                null,
                this,
              null
                );
        editTextTotal.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
            @Override public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
            @Override public void afterTextChanged(Editable editable) {
                if (editTextTotal.length() > 0){
                    mitadAnticipo.setText(String.valueOf(Math.round(Integer.parseInt(editTextTotal.getText().toString()) / 2f)));
                }else mitadAnticipo.setText("");
            }
        });
        recyclerItemsVenta.setAdapter(adapRegVenta);


        actualizarAutocomplete();
        selecItem_autoComplete_codigoArt();


        Intent intent = getIntent();
        if (intent != null && intent.hasExtra("idApartado")) {
            String idPedidoExtra = intent.getStringExtra("idApartado"); // Asegúrate de proveer un valor por defecto
            try {
                idClienteExistente =  jsonPedido.getJSONObject(idPedidoExtra).getString("cliente");
                ((EditText)findViewById(R.id.editTextNombre))           .setText(jsonClientes.getJSONObject(idClienteExistente).getString("nombre"));
                ((EditText)findViewById(R.id.editTextNumeroContacto))   .setText(jsonClientes.getJSONObject(idClienteExistente).getString("numeroTelefono"));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
    }


    public void selecItem_autoComplete_codigoArt(){
        autoComplete_id.setSingleLine();
        autoComplete_id.setOnKeyListener(new View.OnKeyListener() {
            @Override
            public boolean onKey(View v, int keyCode, KeyEvent event) {
                if ((event.getAction() == KeyEvent.ACTION_DOWN) && (keyCode == KeyEvent.KEYCODE_ENTER)) {
                    if(autoComplete_id.length() > 0){
                        String cadena = autoComplete_id.getText().toString();
                        if(cadena.contains(" ")){
                            cadena = cadena.split(" ")[0];
                        }
                        if(jsonArticulos.has(cadena)){
                            pressEnterAutoCompleteID(cadena); autoComplete_id.setText("");
                        }else toast(cadena, getApplicationContext());
                    }
                }
                return (keyCode == KeyEvent.KEYCODE_ENTER);
            }
        });
        autoComplete_id.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int i, long l) {
                if(autoComplete_id.length() > 0){
                    String cadena = autoComplete_id.getText().toString();
                    if(cadena.contains(" ")){
                        cadena = cadena.split(" ")[0];
                    }
                    if(jsonArticulos.has(cadena)){
                        pressEnterAutoCompleteID(cadena); autoComplete_id.setText("");
                    }else toast(cadena, getApplicationContext());
                }
            }
        });
    }
    public void venta_seleccion_(String id, String popTalla, String popSeña, boolean igual){
        JSONObject object = new JSONObject();
        try {
            object.put("id"         , id);


            if(!popTalla.equals(""))object.put("talla"   , popTalla);
            if(!popSeña.equals(""))object.put("seña"   , popSeña);

            object.put("cantidad"   , "1");
            if(jsonArticulos.getJSONObject(id).has("descuento")){
                object.put("descuento"     , jsonArticulos.getJSONObject(id).getString("descuento"));
            } else {
                object.put("precio"        , jsonArticulos.getJSONObject(id).getString("precioVenta"));
            }
            if(jsonArticulos.getJSONObject(id).has("3x2")){
                object.put("3x2"     , "");
            }
            object.put("nombrePublico"  , jsonArticulos.getJSONObject(id).getString("nombre"));
            object.put("descripcion"    , jsonArticulos.getJSONObject(id).getString("referencia"));
            object.put("precio"         , jsonArticulos.getJSONObject(id).getString("precioVenta"));

            consAgregarPrimerArt.setVisibility(View.GONE);
            adapRegVenta.add(object, igual);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public static String numeroClienteGenerar(String proviene){
        String cadena = "";
        String caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        Random random = new Random();
        char[] arreglo = new char[9]; // Arreglo de 9 caracteres

        // Rellenar el arreglo con caracteres aleatorios del conjunto definido
        for (int i = 0; i < arreglo.length; i++) {
            int index = random.nextInt(caracteres.length()); // Obtener un índice aleatorio
            arreglo[i] = caracteres.charAt(index); // Asignar el carácter correspondiente al índice
        }
        if(proviene.equals("cli")){
            if(jsonClientes.length() > 0){
                int x = 0;
                while (x == 0){
                    if(jsonClientes.has(new String(arreglo))){
                        cadena = numeroClienteGenerar(proviene);
                    }else{
                        cadena = new String(arreglo);
                        x = 1;
                    }
                }
            }else cadena = (new String(arreglo));
        } else if (proviene.equals("ap")) {
            if(jsonPedido.length() > 0){
                int x = 0;
                while (x == 0){
                    if(jsonPedido.has(new String(arreglo))){
                        cadena = numeroClienteGenerar(proviene);
                    }else{
                        cadena = new String(arreglo);
                        x = 1;
                    }
                }
            }else cadena = (new String(arreglo));
        }

        return cadena;
    }
    @Override
    public void onClick(View view) {
       if (view.getId() == R.id.butagregarPedido) {
            pop.popConfirmarSimpleBotonUno popConfirmarSimpleBotonUno = new popConfirmarSimpleBotonUno();
            popConfirmarSimpleBotonUno.showPopupWindow(view, "agregarAp", this);
        } else if (view.getId() == R.id.butConfirmarCompra_noTicket) {
            // Aquí puedes agregar el código para el botón "butConfirmarCompra_noTicket"
        } else if (view.getId() == R.id.butArtNoReg_Agr_reg_Ap) {
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            pop.popArtNoRegistrado popArtNoRegistrado = new pop.popArtNoRegistrado();
            popArtNoRegistrado.showPopupWindow(view, null, imm);
        }

    }
    public void eliminarElementoUltimo(){
       editTextTotal.setText("");
    }
    JSONObject js_DatosAP_Iniciar = new JSONObject();
    boolean estadoRegCompletado = false;


    public void salir(){
        super.onBackPressed();
    }

    JSONObject objectEnviar = new JSONObject();
    boolean egregarAP_onbackpressed = false;
    public void ejecutarMandarRegistroA_verRegistro(){

        if(editTextTotal.length()>0 && adapRegVenta.getItemCount() > 0){
            if(((EditText)findViewById(R.id.editTextNombre)).length() > 0){
                if(((EditText)findViewById(R.id.editTextNumeroContacto)).length() > 0){
                    if(((EditText)findViewById(R.id.editTextAnticipoGeneral)).length() > 0){

                        JSONObject objectDatosApartado  = new JSONObject();
                        JSONObject objDatosCliente      = new JSONObject();
                        String numCliente = "";
                        String numApartado= "";

                        if (!idClienteExistente.equals("")){
                            numCliente = idClienteExistente;
                        }else {
                            numCliente = numeroClienteGenerar("cli");
                            try {
                                objectDatosApartado.put("nuevocl",  "");
                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                        }

                        numApartado= numeroClienteGenerar("ap");
                        try {
                            objectDatosApartado.put("nuevoap",  "");
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }

                        try {

                            /** NUEVO CLIENTE **/
                            if (objectDatosApartado.has("nuevocl")){
                                objDatosCliente.put("numeroCliente",  numCliente);
                                objDatosCliente.put("numeroTelefono", ((EditText)findViewById(R.id.editTextNumeroContacto)).getText().toString());
                                objDatosCliente.put("fechaReistro",   getTiempo());
                                objDatosCliente.put("nombre",         ((EditText)findViewById(R.id.editTextNombre)).getText().toString());
                            }else {
                                objDatosCliente.put("nombre",         ((EditText)findViewById(R.id.editTextNombre)).getText().toString());
                                if (jsonClientes.getJSONObject(numCliente).has("listaAp")){
                                    objDatosCliente.put("listaAp", jsonClientes.getJSONObject(numCliente).getJSONArray("listaAp"));
                                    objDatosCliente.getJSONArray("listaAp").put(numApartado);
                                }else {
                                    JSONArray array = new JSONArray();
                                    array.put(jsonClientes.getJSONObject(numCliente).getString("ultimoApartado"));
                                    array.put(numApartado);
                                    objDatosCliente.put("listaAp", array);
                                }
                            }
                            objDatosCliente.put("ultimoApartado", numApartado);


                            /** NUEVO APARTADO **/
                            objectDatosApartado.put("status",     "1");
                            objectDatosApartado.put("numAp",        numApartado);
                            objectDatosApartado.put("articulos",    adapRegVenta.getArray());
                            objectDatosApartado.put("cliente",      numCliente);
                            objectDatosApartado.put("inicioTime",   getTiempo());
                            objectDatosApartado.put("inicio",       fecha_(0, false));
                            objectDatosApartado.put("termina",      ((TextView)findViewById(R.id.editTextFechaTermina_)).getText().toString());
                            objectDatosApartado.put("terminaTime",  sumarDiasAFecha(spinnerDiasPlazo.getSelectedItemPosition() + 1));
                            objectDatosApartado.put("total",        editTextTotal.getText().toString());
                            objectDatosApartado.put("anticipo",     ((EditText)findViewById(R.id.editTextAnticipoGeneral)).getText().toString());
                            objectDatosApartado.put("plazo",        String.valueOf(spinnerDiasPlazo.getSelectedItemPosition() + 1));

                            JSONArray arrayAnticipo = new JSONArray();
                            JSONObject anticipo = new JSONObject();
                            anticipo.put("fecha",       sumarDiasAFecha(0));
                            anticipo.put("cantidad",    ((EditText)findViewById(R.id.editTextAnticipoGeneral)).getText().toString());
                            anticipo.put("resta",
                                    String.valueOf(Integer.parseInt(editTextTotal.getText().toString())
                                            -
                                            Integer.parseInt(((EditText)findViewById(R.id.editTextAnticipoGeneral)).getText().toString())));
                            arrayAnticipo.put(anticipo);
                            objectDatosApartado.put("abonos", arrayAnticipo);

                            objectEnviar.put("cliente",  objDatosCliente);
                            objectEnviar.put("apartado", objectDatosApartado);
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                        egregarAP_onbackpressed = true;
                        onBackPressed();
                    }
                }
            }
        }
        if(!egregarAP_onbackpressed)toast("LLENE TODOS LOS CAMPOS", getApplicationContext());
    }
    @Override
    public void onBackPressed() {
        if(egregarAP_onbackpressed){
            Intent intent = new Intent(this, pedidos.class);
            intent.putExtra("pedidos_1", objectEnviar.toString());
            setResult(RESULT_OK, intent);
           super.onBackPressed();
        }else super.onBackPressed();

    }
    public void actualizarAutocomplete(){
        ArrayList<String> arrayList = new ArrayList<>();
        for (int i = 0 ;i < jsonArticulos.names().length(); i++){
            String id = "";
            try {
                id = jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("id");
                if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has("sigla")){
                    id = id + " " + jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("sigla");
                }
                arrayList.add(id);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }

        }
        autoComplete_id.setAdapter(new ArrayAdapter<String>(getApplicationContext(), android.R.layout.simple_list_item_1, arrayList));
    }



    private void pressEnterAutoCompleteID(String cadena){
        try {
            if(jsonArticulos.getJSONObject(cadena).has("talla") || jsonArticulos.getJSONObject(cadena).has("seña")){
                pop.popVariacion_venta popVariacion_venta = new popVariacion_venta();
                popVariacion_venta.showPopupWindow(getWindow().getDecorView(), null,cadena, 0, adapRegVenta, this);
            }else venta_seleccion_(cadena, "", "", false);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    String fecha_(int plazo, boolean edit) {
        int cont = -1;
        String dia_a = "";
        Calendar c = Calendar.getInstance();//14-30-31-30 -
        int año = c.get(Calendar.YEAR),
                mes = c.get(Calendar.MONTH) + 1,
                dia = c.get(Calendar.DAY_OF_MONTH);

        if(edit){
            try {
                String fechaInicio = jsonPedido.getJSONObject(id_bund).getString("fechaInicio");
                año = Integer.parseInt(fechaInicio.split(" ")[2]);
                mes = mesAdia(fechaInicio.split(" ")[1]);
                dia = Integer.parseInt(fechaInicio.split(" ")[0]);
            } catch (JSONException e) {
                e.printStackTrace();
            }
        }
        int i[] = {0,31,28,31,30,31,30,31,31,30,31,30,31};
        if(mes != 2){
            for(int x = dia; x <= i[mes]; x++){
                cont++;
                if(cont == plazo){dia_a = String.valueOf(x) + " " + String.valueOf(mes); x = i[mes] + 1;}
                else if (x+1 > i[mes]){
                    if(mes==12){mes = 1; año++;}
                    else mes++;
                    x = 0;
                }
            }
        }else {
            for(int x = dia; x <= i[mes]; x++){
                cont++;
                if(cont == plazo){dia_a = String.valueOf(x) + " " + String.valueOf(mes); x = i[mes] + 1;}
                else if (x+1 > i[mes]){
                    if(mes==12){mes = 1; año++;}
                    else mes++;
                    x = 0;
                }
            }
        }


        if(año != 2024 && año != 2028 && año != 2032){

        }
        return dia_a.split(" ")[0] + " de " + enteroAmes(Integer.parseInt(dia_a.split(" ")[1])) + " del " + String.valueOf(c.get(Calendar.YEAR));
    }
    int mesAdia(String mes){
        switch (mes){
            case "ene": return 1;
            case "feb": return 2;
            case "mar": return 3;
            case "abr": return 4;
            case "may": return 5;
            case "jun": return 6;
            case "jul": return 7;
            case "ago": return 8;
            case "sep": return 9;
            case "oct": return 10;
            case "nov": return 11;
            case "dic": return 12;
            default:
                return 0;
        }
    }
    public String enteroAmes(int dia){
        String s = "";
        switch (dia) {
            case 1: s = "Enero";
                break; case 2: s = "Febrero";
                break; case 3: s = "Marzo";
                break; case 4: s = "Abril";
                break; case 5: s = "Mayo";
                break; case 6: s = "Junio";
                break; case 7: s = "Julio";
                break; case 8: s = "Agosto";
                break; case 9: s = "Septiembre";
                break; case 10: s = "Octubre";
                break; case 11: s = "Noviembre";
                break; case 12: s = "Diciembre";
                break;
        }
        return  s;
    }
    private String getTiempo(){
        TimeZone myTimeZone = TimeZone.getTimeZone("America/Mexico_City");
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        simpleDateFormat.setTimeZone(myTimeZone);
        String dateTime = simpleDateFormat.format(new Date());
        return  dateTime;
    }
    private String sumarDiasAFecha(int dias) {
        // Establecer la zona horaria a "America/Mexico_City"
        TimeZone myTimeZone = TimeZone.getTimeZone("America/Mexico_City");

        // Obtener la fecha y hora actuales en la zona horaria especificada
        Calendar calendar = Calendar.getInstance(myTimeZone);

        // Sumar 'dias' días al calendario
        calendar.add(Calendar.DAY_OF_MONTH, dias);

        // Formatear la fecha resultante con año de cuatro dígitos
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("dd/MM/yyyy");
        simpleDateFormat.setTimeZone(myTimeZone);
        String fechaResultado = simpleDateFormat.format(calendar.getTime());

        return fechaResultado;
    }
}




                            /*

                            pop.popupecogerItemSubCategoria_Venta popupecogerItemSubCategoria_venta = new popupecogerItemSubCategoria_Venta();
                            popupecogerItemSubCategoria_venta.showPopupWindow(
                                    this.getWindow().getDecorView(),
                                    null,
                                    adapRegistro,
                                    jsonArticulos.names().getString(x),
                                    imm
                            );
                        } else {
                            adapRegistro.registroIgual(editable);
                        }
                    }
                    recyclerConsultarExistencia.scrollToPosition(adapRegistro.getList().size() - 1);
                }
            }
            autoCompleteBusqedaAgrgarCliente.setText("");
            autoCompleteBusqedaAgrgarCliente.requestFocus();
        }
    }
    private int caledario(int i){
        Date date = new Date();
        Calendar calendar = Calendar.getInstance();
        calendar.setFirstDayOfWeek( Calendar.MONDAY);
        calendar.setMinimalDaysInFirstWeek(4);
        calendar.setTime(date);
        return calendar.get(i);
    }
    int mesAdia(String mes){
        switch (mes){
            case "ene": return 1;
            case "feb": return 2;
            case "mar": return 3;
            case "abr": return 4;
            case "may": return 5;
            case "jun": return 6;
            case "jul": return 7;
            case "ago": return 8;
            case "sep": return 9;
            case "oct": return 10;
            case "nov": return 11;
            case "dic": return 12;
            default:
                return 0;
        }
    }
    public String enteroAmes(int dia){
        String s = "";
        switch (dia) {
            case 1: s = "Enero";
                break; case 2: s = "Febrero";
                break; case 3: s = "Marzo";
                break; case 4: s = "Abril";
                break; case 5: s = "Mayo";
                break; case 6: s = "Junio";
                break; case 7: s = "Julio";
                break; case 8: s = "Agosto";
                break; case 9: s = "Septiembre";
                break; case 10: s = "Octubre";
                break; case 11: s = "Noviembre";
                break; case 12: s = "Diciembre";
                break;
        }
        return  s;
    }
    String fecha_(int plazo, boolean edit) {
        int cont = -1;
        String dia_a = "";
        Calendar c = Calendar.getInstance();//14-30-31-30 -
        int año = c.get(Calendar.YEAR),
                mes = c.get(Calendar.MONTH) + 1,
                dia = c.get(Calendar.DAY_OF_MONTH);

        if(edit){
            try {
                String fechaInicio = jsonPedido.getJSONObject(id_bund).getString("fechaInicio");
                año = Integer.parseInt(fechaInicio.split(" ")[2]);
                mes = mesAdia(fechaInicio.split(" ")[1]);
                dia = Integer.parseInt(fechaInicio.split(" ")[0]);
            } catch (JSONException e) {
                e.printStackTrace();
            }
        }
        int i[] = {0,31,28,31,30,31,30,31,31,30,31,30,31};
        if(mes != 2){
            for(int x = dia; x <= i[mes]; x++){
                cont++;
                if(cont == plazo){dia_a = String.valueOf(x) + " " + String.valueOf(mes); x = i[mes] + 1;}
                else if (x+1 > i[mes]){
                    if(mes==12){mes = 1; año++;}
                    else mes++;
                    x = 0;
                }
            }
        }else {
            for(int x = dia; x <= i[mes]; x++){
                cont++;
                if(cont == plazo){dia_a = String.valueOf(x) + " " + String.valueOf(mes); x = i[mes] + 1;}
                else if (x+1 > i[mes]){
                    if(mes==12){mes = 1; año++;}
                    else mes++;
                    x = 0;
                }
            }
        }


        if(año != 2024 && año != 2028 && año != 2032){

        }
        return dia_a.split(" ")[0] + " de " + enteroAmes(Integer.parseInt(dia_a.split(" ")[1])) + " del " + String.valueOf(c.get(Calendar.YEAR));
    }


    private void initRecyvler(RecyclerView recyclerView){
        recyclerView.setHasFixedSize(true);
        recyclerView.setLayoutManager(new LinearLayoutManager(getApplicationContext()));
    }



    void toast(String s){generales.toast(s, getApplicationContext());}

    private void autocompleteEditText_articulos(){
        ArrayList<String> array = new ArrayList<>();
        for(int i = 1; i < jsonArticulos.names().length(); i++){
            try {
                if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("artDisponible").equals("0")){
                    array.add(jsonArticulos.names().getString(i) + " "
                            + jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("itemNombre") + " "
                            + jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("itemRef")
                    );
                }
            } catch (JSONException e) {
                e.printStackTrace();
            }
        }
        autoCompleteBusqedaAgrgarCliente.setAdapter(new ArrayAdapter<String>(getApplicationContext(), android.R.layout.simple_list_item_1, array));
    }

}

/*
llavero peluche straikds 38
cojin chinin     180
calcetas cc      75
aretes cencillos 10
aretes cencillos 10
aretes tanjiro
credencial
diadema
pasador piedra 30
pasador piedra 32
pinza 30
pasador piedra 29
 */

