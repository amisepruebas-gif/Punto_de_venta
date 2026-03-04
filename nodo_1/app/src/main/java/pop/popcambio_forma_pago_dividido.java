package pop;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.TextView;

import com.example.nodo_1.R;
import com.example.nodo_1.principal;

public class popcambio_forma_pago_dividido {

    int opc;
    principal principal;
    public void showPopupWindow(final View view, String mov, principal principal) {
        this.principal = principal;
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.cambio_forma_pago_dividido, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        TextView textView   = (TextView) popupView.findViewById(R.id.textView40);
        textView.setText(mov.split("-")[0]);

        Button but_opc_1    = (Button) popupView.findViewById(R.id.button11);
        Button but_opc_2    = (Button) popupView.findViewById(R.id.button15);
        Button but_opc_3    = (Button) popupView.findViewById(R.id.button16);

        switch (mov){
            case "TRANSFERENCIA-EFECTIVO":   opc = 0;
                but_opc_1.setText("TARJETA");
                but_opc_2.setText("TRANSFERENCIA");
                break;
            case "TARJETA-EFECTIVO":         opc = 1;
                but_opc_1.setText("TRANSFERENCIA");
                but_opc_2.setText("TARJETA");
                break;
            case "TRANSFERENCIA-TARJETA":    opc = 2;
                but_opc_1.setText("TRANSFERENCIA");
                but_opc_2.setText("EFECTIVO");
                break;
        }
        but_opc_1.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                operacion(0, popupWindow);
            }
        });
        but_opc_2.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                operacion(1, popupWindow);

            }
        });
        but_opc_3.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                operacion(2, popupWindow);
            }
        });
    }
    private void operacion(int but, PopupWindow popupWindow){
        switch (opc){
            case 0:
                if(but == 0){
                    principal.cambiarFormaPago(principal.pagoTarjeta      ,   principal.pagoTarjeta);
                }else if(but == 1){
                    principal.cambiarFormaPago(principal.pagoTransferencia,   principal.pagoTransferencia);
                } else if (but == 2){
                    principal.cambiarFormaPago(principal.pagoEfectivo,        principal.pagoEfectivo);
                }
                break;
            case 1:
                if(but == 0){
                    //transferencia
                }else {
                    //tarjeta
                }
                break;
            case 2:
                if(but == 0){
                    //transferencia
                }else {
                    //efectivo
                }
                break;
        }
        popupWindow.dismiss();
    }
}
