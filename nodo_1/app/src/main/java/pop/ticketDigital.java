package pop;

import static com.example.nodo_1.principal.cambioFormaPago_string;
import static com.example.nodo_1.principal.datosPagoDividido;
import static com.example.nodo_1.principal.datos_cambioFormaPago;
import static com.example.nodo_1.principal.jsonVenta_actual;
import static com.example.nodo_1.principal.movimiento;
import static com.example.nodo_1.principal.pagoDividido;
import static com.example.nodo_1.principal.pagoEfectivo;
import static com.example.nodo_1.principal.pagoTarjeta;
import static com.example.nodo_1.principal.pagoTransferencia;

import android.content.Context;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.TextView;

import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;
import com.example.nodo_1.principal;

import org.json.JSONException;

import adapter.adapTicketCero;

public class ticketDigital {
    String pagoTarjetaStatus = "";
    boolean statusSinTicket_this = false;
    public void showPopupWindow(final View view,  principal principal, boolean statusSinTicket) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_ticket_digital, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);
        this.context = popupView.getContext();

        RecyclerView recyclerView = (RecyclerView) popupView.findViewById(R.id.recyclerTicket_cero);


        RecyclerView.LayoutManager mLayoutManager = new LinearLayoutManager(popupView.getContext());
        recyclerView.setLayoutManager(mLayoutManager);
        adapTicketCero adapTicketCero = null;

        try {
            adapTicketCero = new adapTicketCero(jsonVenta_actual.getJSONArray("articulos"));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        recyclerView.setAdapter(adapTicketCero);

        Button button = (Button)popupView.findViewById(R.id.button128);

        if(statusSinTicket){
            button.setText("CON TICKET");
            ((Button)popupView.findViewById(R.id.button41)).setVisibility(View.VISIBLE);
        }

        ConstraintLayout consPagoTarjetaPuntos = (ConstraintLayout) popupView.findViewById(R.id.constraintLayout62);
        ConstraintLayout consPAgoTarjeta       = (ConstraintLayout) popupView.findViewById(R.id.constraintLayout22);

        TextView
                tipoDePago  = (TextView) popupView.findViewById(R.id.textViewTipoPago),
                fecha       = (TextView) popupView.findViewById(R.id.itemTicket_Date),
                enTurno     = (TextView) popupView.findViewById(R.id.itemTicket_Enturno),
                montoPago   = (TextView) popupView.findViewById(R.id.itemTicket_MontoPago),
                total       = (TextView) popupView.findViewById(R.id.itemTicket_MontoCobro),
                cambio      = (TextView) popupView.findViewById(R.id.itemTicket_Cambio);

        try {
            total       .setText(jsonVenta_actual.getString("montoCobro"));
            String pago = "";
            if(jsonVenta_actual.getString(movimiento).equals(pagoEfectivo)){
                pago = "EFECTIVO";
            } else if (jsonVenta_actual.getString(movimiento).equals(pagoTarjeta)) {
                pago = "TARJETA";
                pagoTarjetaStatus = "PAGO DIVIDIDO NORMAL";
            }else if (jsonVenta_actual.getString(movimiento).equals(pagoTransferencia)) {
                pago = "TRANSFERENCIA";
            }else if (jsonVenta_actual.getString(movimiento).equals(pagoDividido)) {
                if(jsonVenta_actual.has(cambioFormaPago_string)){
                    pago = jsonVenta_actual.getString(cambioFormaPago_string);
                    String cambioPago = "SEGUNDO METODO DE PAGO \n";
                    if(pago.equals(pagoTarjeta))        {
                        cambioPago = cambioPago + "TARJETA";
                        pagoTarjetaStatus = "PAGO DIVIDIDO CAMBIADO";
                        total.setText(jsonVenta_actual.getJSONObject(datosPagoDividido).getString("cantidad_faltante"));
                    }
                    else if (pago.equals(pagoEfectivo)) {
                        cambioPago = cambioPago + "EFECTIVO";
                        total.setText(jsonVenta_actual.getJSONObject(datosPagoDividido).getString("cantidad_faltante"));
                    }
                    pago = cambioPago;
                }else {
                    pago =      jsonVenta_actual.getJSONObject(datosPagoDividido).getString("mov") ;
                    if(jsonVenta_actual.getJSONObject(datosPagoDividido).getString("mov").equals("TRANSFERENCIA-TARJETA")){
                        total       .setText(jsonVenta_actual.getString("montoPago"));
                    }else {
                        total       .setText(jsonVenta_actual.getJSONObject(datosPagoDividido).getString("cantidad_faltante"));
                    }
                }
            }
            tipoDePago  .setText(pago);
            fecha       .setText(jsonVenta_actual.getString("fecha"));
            enTurno     .setText(jsonVenta_actual.getString("enTurno"));
            montoPago   .setText(jsonVenta_actual.getString("montoPago"));

            String s =  String.valueOf(Integer.parseInt(jsonVenta_actual.getString("montoPago")) - Integer.parseInt(total.getText().toString()));
            jsonVenta_actual.put("cambio", s);
            cambio      .setText(s);

            if(!pagoTarjetaStatus.equals("") && comisionTarjeta()){
                consPAgoTarjeta.setVisibility(View.VISIBLE);
                TextView comicion       = (TextView) popupView.findViewById(R.id.textView404);
                TextView totalTarjeta   = (TextView) popupView.findViewById(R.id.textView405);
                if (jsonVenta_actual.has(cambioFormaPago_string)){
                    comicion    .setText(jsonVenta_actual.getJSONObject(datos_cambioFormaPago).getString("comision"));
                    totalTarjeta.setText(jsonVenta_actual.getJSONObject(datos_cambioFormaPago).getString("total_pago_tarjeta"));
                }else {
                    comicion    .setText(jsonVenta_actual.getString("comicion"));
                    totalTarjeta.setText(jsonVenta_actual.getString("total_pago_tarjeta"));
                }
                cambio      .setText("0");
            }else {
                consPAgoTarjeta.setVisibility(View.GONE);
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        ((Button)popupView.findViewById(R.id.button41)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                statusSinTicket_this = true;
                button.callOnClick();
            }
        });
        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    if(!pagoTarjetaStatus.equals("")){
                        principal.pagoTarjeta(jsonVenta_actual.getString("total_pago_tarjeta"), pagoTarjeta);
                    } else {
                        principal.finalizarVenta(statusSinTicket_this);
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                popupWindow.dismiss();
            }
        });
    }
    Context context;
    public boolean comisionTarjeta(){
        boolean estado;
        /** COBRAR COMISION **/
        if(generales.loadData_sharedPreferences(context, "cobrar_comision", context.getString(R.string.cobrar_comision)).equals("0")
                ||generales.loadData_sharedPreferences(context, "cobrar_comision", context.getString(R.string.cobrar_comision)).equals("")
        )estado=false;
        else estado = true;
        return estado;
    }
}
