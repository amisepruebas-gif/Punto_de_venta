package adapter;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class adap_corte_1 extends RecyclerView.Adapter<adap_corte_1.ViewHolder> {

    JSONArray array = new JSONArray();
    Context context;
    public adap_corte_1(Context context){
        this.context = context;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.reg_corte, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView
                nameEnturno = holder.nameEnturno,
                fecha        = holder.fecha,
                status_1     = holder.status_1,
                status_2     = holder.status_2,
                hora_1       = holder.hora_1,
                hora_2       = holder.hora_2,
                cantInicial  = holder.cantInicial,
                venta        = holder.venta,
                total        = holder.total,
                conteo       = holder.conteo;
        ConstraintLayout cons_1 = holder.cons_1, cons_2 = holder.cons_2;

        try {
            JSONObject object = array.getJSONObject(position);
            cons_2.setVisibility(View.VISIBLE);
            cons_1.setVisibility(View.VISIBLE);
            //"10/11/2024"
            if (object.has("1")){
                JSONObject object1 = object.getJSONObject("1");
                String stringfecha = object1.getString("hora");

                fecha       .setText(generales.formatearFecha((stringfecha.split(" ")[0])));
                nameEnturno .setText(object1.getString("enTurno"));
                hora_1      .setText(stringfecha.split(" ")[1]);
                cantInicial .setText(object1.getString("cantidad"));
                status_1    .setText("INICIO");
                status_1.setTextColor(context.getColor(R.color.naranjaDatosSegmento));
            }else {
                cons_1.setVisibility(View.GONE);
            }
            if (!object.has("2")){
                cons_2.setVisibility(View.GONE);
                if(position == array.length()-1){
                    status_1    .setText("EN CURSO");
                    status_1.setTextColor(context.getColor(R.color.morado));
                }else {
                    status_1    .setText("CANCELADO");
                    status_1.setTextColor(context.getColor(R.color.rojo));
                }
            }else {
                JSONObject object2 = object.getJSONObject("2");
                if(object2.has("venta")) venta .setText(object2.getString("venta"));
                else venta.setText("null");
                if(object2.has("hora")) hora_2.setText(object2.getString("finalizado").split(" ")[1]);
                else hora_2.setText("null");
                if(object2.has("total")) total .setText(object2.getString("total"));
                else total.setText("null");
                String status = object2.getString("estado");
                if(status.equals("corte_terminado")){
                    status_2.setText("FLINALIZADO");
                }else if (status.equals("corte_enCurso")){
                    status_2.setText("CANCELADO");
                }
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

    }
    public void actualizar(JSONArray array){
        this.array = array;
        notifyDataSetChanged();
    }
    @Override
    public int getItemCount() {
        return array.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView nameEnturno, fecha, status_1, hora_1, cantInicial, status_2, venta, total, conteo, hora_2;
        ConstraintLayout cons_1, cons_2;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            nameEnturno = (TextView) itemView.findViewById(R.id.textView250);
            fecha       = (TextView) itemView.findViewById(R.id.textView246);
            status_1    = (TextView) itemView.findViewById(R.id.textView223);
            status_2    = (TextView) itemView.findViewById(R.id.textView255);
            hora_1      = (TextView) itemView.findViewById(R.id.textView247);
            hora_2      = (TextView) itemView.findViewById(R.id.textView258);
            cantInicial = (TextView) itemView.findViewById(R.id.textView253);
            venta       = (TextView) itemView.findViewById(R.id.textView264);
            total       = (TextView) itemView.findViewById(R.id.textView267);
            conteo      = (TextView) itemView.findViewById(R.id.textView26_3);
            cons_1      = (ConstraintLayout) itemView.findViewById(R.id.cons_1_corte_reg);
            cons_2      = (ConstraintLayout) itemView.findViewById(R.id.cons_2_corte_reg);
        }
    }
}
