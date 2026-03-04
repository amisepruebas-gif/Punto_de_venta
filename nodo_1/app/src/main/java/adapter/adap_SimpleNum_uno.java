package adapter;

import static com.example.nodo_1.principal.jsonPedido;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;


public class adap_SimpleNum_uno extends RecyclerView.Adapter<adap_SimpleNum_uno.ViewHolder> {

    Context context;
    TextView total, resta, restaActualizado,txtNoApartado, txtNumAp_masDeUno, txtRestActualizado;
    EditText anticipo;
    boolean liquidacion;
    int tamaño; String id;
    List<String> list = new ArrayList<String>();

    int color = -1;

    pop.popCancelarAgregarPago_AP popCancelarAgregarPago_ap;
    public adap_SimpleNum_uno(TextView txtNoApartado,
                              TextView total,
                              TextView resta,
                              EditText anticipo,
                              TextView restaActuaizado,
                              int tamaño,
                              String id,
                              Context context,
                              TextView txtNumAp_masDeUno,
                              TextView txtRestActualizado,
                              boolean liquidacion,
                              adapterClientesPedidos adapterClientesPedidos,
                              pop.popCancelarAgregarPago_AP popCancelarAgregarPago_ap){

        this.popCancelarAgregarPago_ap = popCancelarAgregarPago_ap;
        //list = adapterClientesPedidos.getListAdapContPrin();
        this.liquidacion = liquidacion;
        this.txtRestActualizado = txtRestActualizado;
        this.txtNumAp_masDeUno = txtNumAp_masDeUno;
        this.txtNoApartado = txtNoApartado;
        this.context = context;
        this.id = id;
        this.total = total;
        this.resta = resta;
        this.anticipo = anticipo;
        this.restaActualizado = restaActuaizado;
        this.tamaño = tamaño;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.layout_reciclereditap, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull final ViewHolder holder, final int position) {
        Button button = holder.boton;
        button.setText(String.valueOf(position + 1));

        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                txtNoApartado.setText("Apartado No. " + String.valueOf(holder.getAdapterPosition() + 1));
                try {
                    liquidacion = false;
                    txtRestActualizado.setText("");
                    txtNumAp_masDeUno.setText(String.valueOf(holder.getAdapterPosition()));
                    String total_b = jsonPedido.getJSONObject(list.get(holder.getAdapterPosition())).getString("total");
                    int tam = jsonPedido.getJSONObject(
                            list.get(holder.getAdapterPosition())).getJSONArray("pagos").length();
                    total.setText(total_b);
                    int pagos = 0;
                    for (int i = 0; i < tam; i++){
                        pagos = pagos + Integer.parseInt(jsonPedido.getJSONObject(
                                list.get(holder.getAdapterPosition())).getJSONArray("pagos").getString(i).split("&")[0]);
                    }
                    resta.setText(String.valueOf(Integer.parseInt(total_b) - pagos));
                    if(anticipo.length() > 0){
                        anticipo.setText("");
                        restaActualizado.setText("");
                    }

                    int color_anterior = color;
                    if(color_anterior >= 0){
                        notifyItemChanged(color_anterior);
                    }
                    color = holder.getAdapterPosition();
                    notifyItemChanged(color);
                    popCancelarAgregarPago_ap.returnSeleccion(color);
                } catch (JSONException e) {
                    toast("error");
                    e.printStackTrace();
                }
            }
        });

        if(color >= 0){
            if(position == color){
                if(android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.JELLY_BEAN) {
                    button.setBackgroundDrawable(ContextCompat.getDrawable(context,  R.drawable.cuadro_esq_red_amarillo_suave));
                } else {
                    button.setBackground(ContextCompat.getDrawable(context,  R.drawable.cuadro_esq_red_amarillo_suave));
                }
            } else {
                if(android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.JELLY_BEAN) {
                    button.setBackgroundDrawable(ContextCompat.getDrawable(context,  R.drawable.cuadro_esq_red_blanco));
                } else {
                    button.setBackground(ContextCompat.getDrawable(context,  R.drawable.cuadro_esq_red_blanco));
                }
            }
        }else {
            if(android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.JELLY_BEAN) {
                button.setBackgroundDrawable(ContextCompat.getDrawable(context,  R.drawable.cuadro_esq_red_blanco));
            } else {
                button.setBackground(ContextCompat.getDrawable(context,  R.drawable.cuadro_esq_red_blanco));
            }
        }
    }

    @Override
    public int getItemCount() {
        return tamaño;
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        Button boton;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            boton = (Button)itemView.findViewById(R.id.butEditApNumRecicler);
        }
    }


    void toast(String s){
        generales.toast(s, context); }
}
