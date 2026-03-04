package pop;


import static com.example.nodo_1.principal.jsonDatos;
import static com.example.nodo_1.principal.jsonMensajes;
import static com.example.nodo_1.principal.jsonVenta;
import static pop.pop_corte.key_corte;
import static pop.pop_corte.name_corte;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.TextView;

import androidx.constraintlayout.widget.ConstraintLayout;

import com.example.nodo_1.R;
import com.example.nodo_1.fire;
import com.example.nodo_1.generales;
import com.example.nodo_1.principal;
import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.TimeZone;


public class pop_corte_uno {

    Context context;
    String enTurno = "";

    public void showPopupWindow(final View view, String enTurno, principal principal) {
        this.enTurno = enTurno;
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.corte, null);


        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        context = popupView.getContext();

        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        TextView view_enTurno = (TextView) popupView.findViewById(R.id.textView552);
        Button iniciarTerminar              = (Button)          popupView.findViewById(R.id.button174);
        ConstraintLayout conspopDatos_corte = (ConstraintLayout)popupView.findViewById(R.id.conspopDatos_corte);
        ConstraintLayout consBloquearPant   = (ConstraintLayout)popupView.findViewById(R.id.constraintLayout69);
        ConstraintLayout consCorteBasico    = (ConstraintLayout) popupView.findViewById(R.id.consCorteBasico);
        TextView txtHora         = (TextView) popupView.findViewById(R.id.textView555);
        TextView txtEnturno      = (TextView) popupView.findViewById((R.id.textView556));
        TextView txtCantidad     = (TextView) popupView.findViewById(R.id.textView560);
        TextView venta           = (TextView) popupView.findViewById(R.id.textView561);
        TextView total           = (TextView) popupView.findViewById(R.id.textViewColor_regVenta);
        EditText editCantDinero  = (EditText) popupView.findViewById(R.id.editTextTextPersonName32);
        Button   empezar         = (Button)   popupView.findViewById(R.id.button175);
        TextView corteEnCurso    = (TextView) popupView.findViewById(R.id.textView371);





        Map<String, Object> MapCorte = new HashMap<>();
        MapCorte.put("corte", getPref());
        //mainActivity.subirDatosCorteBasico(MapCorte);


        if(getPref().equals("")){
            iniciarTerminar.setText("INICIAR");

            empezar.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    if(estadoDiaIgual(editCantDinero.getText().toString()) == 1){
                        popupWindow.dismiss();
                    } else if(estadoDiaIgual(editCantDinero.getText().toString()) == 0){
                        popupWindow.dismiss();
                    } else {
                        generales.toast("error pop 1", popupView.getContext());
                    }
                }
            });
            corteEnCurso.setVisibility(View.GONE);
            view_enTurno.setText(enTurno);
        }else {
            iniciarTerminar.setText("TERMINAR");
            editCantDinero.setText(getPref().split("ç")[1]);
            editCantDinero.setEnabled(false);
            corteEnCurso.setVisibility(View.VISIBLE);
            view_enTurno.setText(getPref().split("ç")[2]);
        }
        iniciarTerminar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(getPref().equals("")){
                    if(editCantDinero.length() > 0){
                        if(!editCantDinero.getText().toString().equals(0)){
                            conspopDatos_corte.setVisibility(View.VISIBLE);
                            consBloquearPant.setVisibility(View.VISIBLE);



                            txtHora.setText(returHora());
                            txtEnturno.setText(enTurno);
                            txtCantidad.setText(editCantDinero.getText().toString());
                            editCantDinero.setEnabled(false);
                        }
                    }
                } else {
                    if(estadoDiaIgual("") == 1){
                        try {
                            JSONObject
                                    jsonDias = jsonVenta.getJSONObject(principal.años.get(principal.años.size()-1)).
                                    getJSONObject(principal.meses.get(principal.años.size()-1).get(principal.meses.get(principal.años.size()-1).size()-1));
                            String ultimoDia = String.valueOf(coleccionDias(jsonDias)[coleccionDias(jsonDias).length-1]);
                            JSONObject json_ventas = jsonDias.getJSONObject(ultimoDia);
                            int suma = 0;
                            int[] jsIDventas = new int[json_ventas.names().length()];
                            for (int i = 0; i < json_ventas.names().length(); i++){jsIDventas[i] = Integer.parseInt(json_ventas.names().getString(i));}
                            Arrays.sort(jsIDventas);

                            boolean estado = false;
                            if(getPref().split("ç")[0].equals("0")){

                                for (int i = 0; i < jsonDias.getJSONObject(ultimoDia).names().length(); i++){
                                    suma = suma +
                                            Integer.parseInt(jsonDias.getJSONObject(ultimoDia).getJSONObject(jsonDias.getJSONObject(ultimoDia).names().getString(i)).getString("montoCobro"));
                                }
                                consCorteBasico.setVisibility(View.VISIBLE);


                                venta.setText(String.valueOf(suma));
                                total.setText(String.valueOf(suma + Integer.parseInt(getPref().split("ç")[1])));
                            } else {
                                if (!getPref().split("ç")[0].equals(String.valueOf(jsIDventas[jsIDventas.length-1]))){
                                    consCorteBasico.setVisibility(View.VISIBLE);


                                    for (int i = 0; i < jsonDias.getJSONObject(ultimoDia).names().length(); i++){
                                        if(jsIDventas[i] > Integer.parseInt(getPref().split("ç")[0])){
                                            suma = suma +
                                                    Integer.parseInt(
                                                            jsonDias.getJSONObject(ultimoDia).getJSONObject(String.valueOf(jsIDventas[i])).getString("montoCobro"));
                                        }
                                    }
                                    venta.setText(String.valueOf(suma));
                                    total.setText(String.valueOf(suma + Integer.parseInt(getPref().split("ç")[1])));
                                    generales.saveData_sharedPreferences(context, name_corte, key_corte, "");
                                } else {
                                    generales.toast("Aún no se han reportado ingresos, desde el ultimo corte.", context); estado = true;
                                }
                            }
                            if(!estado){
                                JSONObject object = new JSONObject();
                                JSONObject jsn = new JSONObject();
                                jsn.put("enTurno",view_enTurno.getText().toString());
                                jsn.put("cantInicial",editCantDinero.getText().toString());
                                jsn.put("venta",venta.getText().toString());
                                jsn.put("total",total.getText().toString());
                                String s =
                                        "CORTE \n" +
                                                "EN TURNO "         + view_enTurno.getText().toString() + "\n" +
                                                "CANTIDAD INIC. $ " + editCantDinero.getText().toString() + "\n" +
                                                "VENTA $ "          + venta.getText().toString() + "\n" +
                                                "TOTAL $ "          + total.getText().toString();

                                object.put("texto", s);

                                /** USUARIO **/
                                String usr = enTurno, maq = "3", hora = getTiempo();


                                object.put("usuario", usr);
                                object.put("maquina", maq);
                                object.put("hora", hora);
                                object.put("corte", jsn);

                                String direccion = getAnñoMesDiaHora("año")+"-"+getAnñoMesDiaHora("mes");

                                if(jsonMensajes.has(direccion)){
                                    if(jsonMensajes.getJSONObject(direccion).has(getAnñoMesDiaHora("dia"))){
                                        jsonMensajes.getJSONObject(direccion).getJSONArray(getAnñoMesDiaHora("dia")).put(object);
                                    }else {
                                        JSONArray jsonArray = new JSONArray();
                                        object.put("nuevoDia", "");
                                        jsonArray.put(object);
                                        jsonMensajes.getJSONObject(direccion).put(getAnñoMesDiaHora("dia"), jsonArray);
                                    }

                                    for (int i = 1; i <= 4; i ++){
                                        /** USUARIO **/
                                        if(!String.valueOf(i).equals("3")){
                                            jsonDatos.getJSONObject("mensaje").put(String.valueOf(i), "1");
                                        }else {
                                            jsonDatos.getJSONObject("mensaje").put(String.valueOf(i), "0");
                                        }
                                    }
                                    fire.documenRef("mensajes/"+direccion).update(
                                            new Gson().fromJson(jsonMensajes.getJSONObject(direccion).toString(), HashMap.class));
                                    fire.documenRef("datos/"+"mensaje").update(
                                            new Gson().fromJson(jsonDatos.getJSONObject("mensaje").toString(), HashMap.class));

                                } else {
                                    JSONArray jsonArray = new JSONArray();
                                    object.put("nuevoDia", "");
                                    object.put("inicioDeMes", "");
                                    jsonArray.put(object);
                                    JSONObject obj = new JSONObject();
                                    obj.put(getAnñoMesDiaHora("dia"), jsonArray);
                                    jsonMensajes.put(direccion,obj);
                                    fire.documenRef("mensajes/"+direccion).set(
                                            new Gson().fromJson(jsonMensajes.getJSONObject(direccion).toString(), HashMap.class));
                                }



                                iniciarTerminar.setVisibility(View.GONE);
                                corteEnCurso.setText("CORTE FINALIZADO");
                                setPref("");
                                JSONObject datos_ = new JSONObject();
                                try {
                                    datos_.put("finalizdo", returHora());
                                } catch (JSONException e) {
                                    throw new RuntimeException(e);
                                }
                                jsonDatos.put("corte", datos_);
                                //mainActivity.spinnerNoEspecificado();
                                fire.documenRef("datos/corte").set(new Gson().fromJson(datos_.toString(), HashMap.class));
                            }
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    } else generales.toast("Aún no se han reportado ingresos.", context);
                }
            }
        });
    }
    private String getAnñoMesDiaHora(String get){
        TimeZone myTimeZone = TimeZone.getTimeZone("America/Mexico_City");
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        simpleDateFormat.setTimeZone(myTimeZone);
        String dateTime = simpleDateFormat.format(new Date());
        //                                2020-08-20 16:40:34
        if(get.equals("año")){return (dateTime.split(" ")[0]).split("-")[0].substring(2);}
        else if (get.equals("mes")){return (dateTime.split(" ")[0]).split("-")[1];}
        else if (get.equals("dia")){return (dateTime.split(" ")[0]).split("-")[2];}
        else if (get.equals("hora")){return (dateTime.split(" ")[1]);}
        return "null";
    }
    private String getTiempo(){
        TimeZone myTimeZone = TimeZone.getTimeZone("America/Mexico_City");
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        simpleDateFormat.setTimeZone(myTimeZone);
        String dateTime = simpleDateFormat.format(new Date());
        return  dateTime;
    }
    private void setPref(String s){
        generales.saveData_sharedPreferences(context, "keyPopcorteUno","keyPopcorteUno" ,s);
    }
    private String getPref(){
        return generales.loadData_sharedPreferences(context, "keyPopcorteUno", "keyPopcorteUno");
    }

    private int estadoDiaIgual(String cantidad){

        Calendar c = Calendar.getInstance();
        String dia = String.valueOf(c.get(Calendar.DAY_OF_MONTH));
        try {
            JSONObject
                    jsonDias = jsonVenta.getJSONObject(principal.años.get(principal.años.size()-1)).
                    getJSONObject(principal.meses.get(principal.años.size()-1).get(principal.meses.get(principal.años.size()-1).size()-1));


            int[] jsDias = coleccionDias(jsonDias);
            for (int i = 0; i < jsonDias.names().length(); i++){jsDias[i] = Integer.parseInt(jsonDias.names().getString(i));}
            Arrays.sort(jsDias);



            JSONObject json_ventas = jsonDias.getJSONObject(String.valueOf(jsDias[jsDias.length-1]));
            int[] jsIDventas = new int[json_ventas.names().length()];
            for (int i = 0; i < json_ventas.names().length(); i++){jsIDventas[i] = Integer.parseInt(json_ventas.names().getString(i));}
            Arrays.sort(jsIDventas);

            JSONObject datos_ = new JSONObject();
            try {
                datos_.put("enTurno"        , enTurno);
                datos_.put("cantidadInicial", cantidad);
                datos_.put("hora inicio"    , returHora());
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
            jsonDatos.put("corte", datos_);
            fire.documenRef("datos/corte").set(new Gson().fromJson(datos_.toString(), HashMap.class));

            if(dia.equals(String.valueOf(jsDias[jsDias.length-1]))){ // es igual
                if(!cantidad.equals("")) {
                    setPref(String.valueOf(jsIDventas[jsIDventas.length-1]) + "ç" + cantidad  + "ç" + enTurno);
                }
                return 1;
            } else {
                if (!cantidad.equals("")) {
                    setPref("0" + "ç" + cantidad  + "ç" + enTurno);
                }                                              // no es igual
                return 0;
            }

        } catch (JSONException e) {
            return -1;
        }
    }
    private int[] coleccionDias(JSONObject jsonDias){
        int[] jsDias = new int[jsonDias.names().length()];
        for (int i = 0; i < jsonDias.names().length(); i++){
            try {
                jsDias[i] = Integer.parseInt(jsonDias.names().getString(i));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        Arrays.sort(jsDias);
        return jsDias;
    }
    private String returHora(){
        DateFormat dateFormat = new SimpleDateFormat("HH:mm:ss");
        Date date = new Date();
        return dateFormat.format(date);
    }
    int c = 0;
    private void gotoUrl(String s) {
        Uri uri = Uri.parse(s);
        context.startActivity(new Intent(Intent.ACTION_VIEW,uri));

    }
}
