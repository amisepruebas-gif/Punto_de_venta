package pop;


import static com.example.nodo_1.generales.generarID;
import static com.example.nodo_1.generales.getAnñoMesDiaHora;
import static com.example.nodo_1.generales.quitarCero;
import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonCorteHistorial;
import static com.example.nodo_1.principal.jsonVenta;
import static com.example.nodo_1.principal.objectFechasCorte;

import android.content.Context;
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
import com.example.nodo_1.generales;
import com.example.nodo_1.mandarPorMensaje;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.TimeZone;

public class pop_corte {

    public static String key_corte          = "key_corte";
    public static String name_corte         = "name_corte";
    public static String corte_iniciar      = "corte_iniciar";
    public static String corte_terminado    = "corte_terminado";
    public static String corte_enCurso      = "corte_enCurso";
    Context context;
    public void showPopupWindow(final View view, String enTurno) {
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


        String añoActual = "20" + getAnñoMesDiaHora("año");
        String mesActual = quitarCero(getAnñoMesDiaHora("mes"));
        String diaActual = quitarCero(getAnñoMesDiaHora("dia"));

        //generales.saveData_sharedPreferences(context, name_corte, key_corte, "");
        String contenidoShare = generales.loadData_sharedPreferences(context, key_corte, name_corte);
        JSONObject object;
        String estado = "iniciar";
        if(!contenidoShare.equals("")){
            try {
                object = new JSONObject(contenidoShare);
                if(      object.getString("estado").equals(corte_terminado)){estado = "iniciar";}
                else if (object.getString("estado").equals(corte_enCurso))  {estado = "terminar";}
                else if (object.getString("estado").equals(corte_iniciar))  {estado = "iniciar_sin_venta";}
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }

        switch (estado){
            case "iniciar":
                view_enTurno.setText(enTurno);
                corteEnCurso.setText("INICIAR CORTE");
                conspopDatos_corte.setVisibility(View.GONE);
                consCorteBasico.setVisibility(View.GONE);
                iniciarTerminar.setText("INICIAR");
                iniciarTerminar.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        if(editCantDinero.length() > 0)
                        {
                            try {
                                String huella = generarID();
                                consBloquearPant.setVisibility(View.VISIBLE);
                                JSONObject obj_direccion = new JSONObject();
                                obj_direccion.put("hora"            , getTiempo());
                                obj_direccion.put("enTurno"         , enTurno);
                                obj_direccion.put("cantidad"        , editCantDinero.getText().toString());
                                obj_direccion.put("estado"          , corte_iniciar);
                                obj_direccion.put("huella"          , huella);

                                generales.saveData_sharedPreferences(context, name_corte, key_corte, obj_direccion.toString());
                                consBloquearPant  .setVisibility(View.VISIBLE);
                                conspopDatos_corte.setVisibility(View.VISIBLE);
                                txtHora         .setText(obj_direccion.getString("hora"));
                                txtEnturno      .setText(obj_direccion.getString("enTurno"));
                                txtCantidad     .setText(obj_direccion.getString("cantidad"));
                                editCantDinero  .setEnabled(false);
                                iniciarTerminar .setEnabled(false);

                                /**actualizar fechas de venta**/
                                new venta.actualizarFechas().init(añoActual, mesActual, diaActual, objectFechasCorte, "jsonCorteHistorial", popupView.getContext());

                                JSONObject objectHist = new JSONObject();
                                objectHist.put(huella, obj_direccion);
                                /**subir venta**/
                                new modulos_carga.subir_documento_sobre_fechas().init(
                                        jsonCorteHistorial,
                                        objectHist,
                                        añoActual,
                                        mesActual,
                                        diaActual,
                                        context,
                                        "jsonCorteHistorial"
                                );

                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                        }
                    }
                });

                empezar.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        popupWindow.dismiss();
                    }
                });
                break;
            case "terminar":
                iniciarTerminar.setText("TERMINAR");
                consCorteBasico     .setVisibility(View.GONE);
                consBloquearPant    .setVisibility(View.GONE);
                conspopDatos_corte  .setVisibility(View.GONE);

                try {
                    String obj = generales.loadData_sharedPreferences(context, key_corte, name_corte);
                    JSONObject obj_direccion = new JSONObject(obj);
                    corteEnCurso.setText("CORTE INICIADO   : "  + obj_direccion.getString("hora").split(" ")[1]);
                    view_enTurno    .setText(obj_direccion.getString("enTurno"));
                    editCantDinero  .setText(obj_direccion.getString("cantidad"));
                    editCantDinero.setEnabled(false);


                    iniciarTerminar.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            consCorteBasico .setVisibility(View.VISIBLE);

                            try {

                                String cantInicial  =  obj_direccion.getString("cantidad");
                                String año          =  obj_direccion.getString("idVenta_corte").split("-")[0];
                                String mes          =  obj_direccion.getString("idVenta_corte").split("-")[1];
                                String dia          =  obj_direccion.getString("idVenta_corte").split("-")[2];
                                String idVenta      =  obj_direccion.getString("idVenta_corte").split("-")[3];

                                JSONArray objInit =
                                        jsonVenta.getJSONObject(año).
                                                getJSONObject(mes).
                                                getJSONObject(dia).getJSONArray("registro");

                                boolean estado_conteoCorte = false;
                                int suma = 0;
                                for (int i = 0; i < objInit.length(); i++){

                                    if(String.valueOf(i).equals(idVenta) || estado_conteoCorte){
                                        estado_conteoCorte = true;
                                        suma = suma + Integer.parseInt((objInit.getJSONObject(i).
                                                getString("montoCobro")));
                                    }
                                }
                                venta           .setText(String.valueOf(suma));
                                total           .setText(String.valueOf(Integer.parseInt(cantInicial) + suma));
                                view_enTurno    .setText(obj_direccion.getString("enTurno"));
                                editCantDinero  .setEnabled(false);
                                editCantDinero  .setText(cantInicial);

                                obj_direccion   .put("estado"              , corte_terminado);
                                obj_direccion   .put("finalizado"          , getTiempo());
                                corteEnCurso    .setText(
                                        "CORTE INICIADO        : "  + obj_direccion.getString("hora").split(" ")[1]
                                                + "\n" +  "CORTE FINALIZADO  : "  + obj_direccion.getString("finalizado").split(" ")[1]  );

                                mandarPorMensaje mandarMensaje = new mandarPorMensaje();
                                mandarMensaje.mandarMensaje(obj_direccion.getString("enTurno"),
                                        "CORTE INICIADO:       "           + obj_direccion.getString("hora").split(" ")[1]        + "\n" +
                                                "CORTE FINALIZADO: "               + obj_direccion.getString("finalizado").split(" ")[1]  + "\n" +
                                                "CANT. INICIAL:           $"       + cantInicial                                                     + "\n" +
                                                "VENTA:                        $"  + String.valueOf(suma)                                            + "\n" +
                                                "TOTAL:                        $"  + String.valueOf(Integer.parseInt(cantInicial) + suma)
                                        ,context);

                                /**actualizar fechas de venta**/
                                new venta.actualizarFechas().init(añoActual, mesActual, diaActual, objectFechasCorte, "jsonCorteHistorial", popupView.getContext());
                                obj_direccion.put("venta", String.valueOf(suma));
                                obj_direccion.put("total", String.valueOf(Integer.parseInt(cantInicial) + suma));
                                obj_direccion.put("hora" , getTiempo().split(" ")[1]);

                                try {
                                    JSONObject objectHist = new JSONObject();
                                    objectHist.put(obj_direccion.getString("huella"), obj_direccion);
                                    new modulos_carga.subir_documento_sobre_fechas().init(
                                            jsonCorteHistorial,
                                            new JSONObject(objectHist.toString()),
                                            añoActual,
                                            mesActual,
                                            diaActual,
                                            context,
                                            "jsonCorteHistorial"
                                    );
                                }catch (JSONException e){

                                }
                                generales.saveData_sharedPreferences(context, name_corte, key_corte, obj_direccion.toString());
                                iniciarTerminar.setVisibility(View.GONE);
                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }

                        }
                    });
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                break;
            case "iniciar_sin_venta":
                iniciarTerminar.setText("CANCELAR CORTE");
                consCorteBasico     .setVisibility(View.GONE);
                consBloquearPant    .setVisibility(View.GONE);
                conspopDatos_corte  .setVisibility(View.GONE);

                String obj = generales.loadData_sharedPreferences(context, key_corte, name_corte);
                JSONObject obj_direccion = null;
                try {
                    obj_direccion = new JSONObject(obj);
                    corteEnCurso.setText("CORTE INICIADO, AUN NO HAY VENTAS REGISTRADAS");
                    view_enTurno    .setText(obj_direccion.getString("enTurno"));
                    editCantDinero  .setText(obj_direccion.getString("cantidad"));
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }

                iniciarTerminar.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {

                    }
                });
                break;
        }

    }

    private void t(String s){
        generales.toast(s, context);
    }
    private String getTiempo(){
        TimeZone myTimeZone = TimeZone.getTimeZone("America/Mexico_City");
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        simpleDateFormat.setTimeZone(myTimeZone);
        String dateTime = simpleDateFormat.format(new Date());
        return  dateTime;
    }

}
