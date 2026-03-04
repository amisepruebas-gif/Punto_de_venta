package pop;

import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.TextView;

import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.core.content.ContextCompat;

import com.example.nodo_1.R;
import com.example.nodo_1.principal;

public class popPagoDividido {
    String mov = "";
    String mov_base = "";
    String tituloPrimerPago ="";
    public void showPopupWindow(final View view, principal principal, String cantidadTotal) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pago_dividido, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;


        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        TextView movimiento              = (TextView) popupView.findViewById(R.id.textView28);
        TextView txt_pago_secundario     = (TextView) popupView.findViewById(R.id.textView29);
        EditText editCant_moviemiento    = (EditText) popupView.findViewById(R.id.editTextText2);
        EditText editCant_efectivo       = (EditText) popupView.findViewById(R.id.editTextText3);
        Button but_trans_efec            = (Button)   popupView.findViewById(R.id.button3);
        Button but_tarje_efec            = (Button)   popupView.findViewById(R.id.button4);
        Button but_tarjeta_trans         = (Button)   popupView.findViewById(R.id.button14);
        Button but_confirmar             = (Button)   popupView.findViewById(R.id.button7);
        TextView txtComision             = (TextView) popupView.findViewById(R.id.textView47);

        ConstraintLayout consComicion    = (ConstraintLayout) popupView.findViewById(R.id.consComicionTarjeta_pagoDiv);
        consComicion.setVisibility(View.GONE);

        editCant_moviemiento.setEnabled(false);
        editCant_efectivo   .setEnabled(false);
        but_trans_efec.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                movimiento          .setText("TRANSFERENCIA");
                movimiento          .setTextColor(ContextCompat.getColor(popupView.getContext(), R.color.naranja_fuerte));
                editCant_moviemiento.setEnabled(true);
                but_trans_efec      .setVisibility(View.GONE);
                but_tarje_efec      .setVisibility(View.GONE);
                but_tarjeta_trans   .setVisibility(View.GONE);
                but_confirmar       .setVisibility(View.VISIBLE);
                txt_pago_secundario .setText("EFECTIVO");
                mov = "TRANSFERENCIA-EFECTIVO";
                mov_base = principal.pagoTransferencia;
                tituloPrimerPago = "TRANSFERENCIA";
            }
        });
        but_tarje_efec.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                movimiento          .setText("TARJETA");
                movimiento          .setTextColor(ContextCompat.getColor(popupView.getContext(), R.color.naranja_fuerte));
                editCant_moviemiento.setEnabled(true);
                but_trans_efec      .setVisibility(View.GONE);
                but_tarje_efec      .setVisibility(View.GONE);
                but_tarjeta_trans   .setVisibility(View.GONE);
                but_confirmar       .setVisibility(View.VISIBLE);
                txt_pago_secundario .setText("EFECTIVO");
                mov = "TARJETA-EFECTIVO";
                mov_base = principal.pagoTarjeta;
                consComicion.setVisibility(View.VISIBLE);
                tituloPrimerPago = "TARJETA";
            }
        });
        but_tarjeta_trans.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                movimiento          .setText("TRANSFERENCIA");
                movimiento          .setTextColor(ContextCompat.getColor(popupView.getContext(), R.color.naranja_fuerte));
                editCant_moviemiento.setEnabled(true);
                but_trans_efec      .setVisibility(View.GONE);
                but_tarje_efec      .setVisibility(View.GONE);
                but_tarjeta_trans   .setVisibility(View.GONE);
                but_confirmar       .setVisibility(View.VISIBLE);
                txt_pago_secundario .setText("TARJETA");
                mov = "TRANSFERENCIA-TARJETA";
                mov_base = principal.pagoTransferencia;
                consComicion.setVisibility(View.VISIBLE);
                tituloPrimerPago = "TRANSFERENCIA";
            }
        });
        but_confirmar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if(mov.equals("TRANSFERENCIA-TARJETA")){
                    principal.pagoDividido_pop(mov_base, editCant_efectivo.getText().toString(), mov, tituloPrimerPago);
                }else {
                    principal.pagoDividido_pop(mov_base, editCant_moviemiento.getText().toString(), mov, tituloPrimerPago);
                }
                popupWindow.dismiss();
            }
        });
        editCant_moviemiento.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {}
            @Override public void afterTextChanged(Editable s) {
                if(editCant_moviemiento.length() > 0){
                    if (!editCant_moviemiento.getText().toString().equals("0")){
                        editCant_efectivo.setText(
                                String.valueOf(Integer.parseInt(cantidadTotal) - Integer.parseInt(editCant_moviemiento.getText().toString()))
                        );
                        if(mov.equals("TRANSFERENCIA-TARJETA")){
                            txtComision.setText(String.valueOf(Math.round(Float.parseFloat(editCant_efectivo   .getText().toString()) * 0.04f)));
                        }else {
                            txtComision.setText(String.valueOf(Math.round(Float.parseFloat(editCant_moviemiento.getText().toString()) * 0.04f)));
                        }
                    }
                }
            }
        });

    }
}
