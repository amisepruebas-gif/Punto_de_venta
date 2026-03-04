package adapter;

import static com.example.nodo_1.principal.jsonArticulos;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import fragmentVenta.mas_vendidos;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class adapMasvendidos extends RecyclerView.Adapter<adapMasvendidos.ViewHolder> {
    JSONArray array = new JSONArray();

    mas_vendidos mas_vendidos;
    public adapMasvendidos(JSONArray array, mas_vendidos mas_vendidos){
        this.mas_vendidos = mas_vendidos;
        this.array = array;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.reg_mas_vendido, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView id = holder.id, nombre = holder.nombre, referencia = holder.referencia,precio = holder.precio, cantidad = holder.cantidad;
        TextView statusSwitchTxt = holder.statusSwitchTxt;
        Button butVerPorID = holder.butVerPorID;

        try {
            JSONObject   obj = jsonArticulos.getJSONObject(array.getJSONObject(position).getString("id"));
            id          .setText(obj.getString("id"));
            nombre      .setText(obj.getString("nombre"));
            referencia  .setText(obj.getString("referencia"));
            precio      .setText(obj.getString("precioVenta"));
            cantidad    .setText(obj.getString("cantidad"));


            statusSwitchTxt.setText(array.getJSONObject(position).getString("cantidad"));

            butVerPorID.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    try {
                        mas_vendidos.verPorID(array.getJSONObject(holder.getAdapterPosition()).getString("id"));
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            });
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public int getItemCount() {
        return array.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView id, nombre, referencia,precio, cantidad, statusSwitchTxt;
        Button butVerPorID;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            id          = (TextView) itemView.findViewById(R.id.txtIdreg_3x2);
            nombre      = (TextView) itemView.findViewById(R.id.nom_3x2reg);
            referencia  = (TextView) itemView.findViewById(R.id.referencia_3x2reg);
            precio      = (TextView) itemView.findViewById(R.id.precio_3x2reg);
            cantidad    = (TextView) itemView.findViewById(R.id.cant_3x2reg);

            statusSwitchTxt = (TextView)itemView.findViewById(R.id.statusSwitchTxt);

            butVerPorID = (Button) itemView.findViewById(R.id.butVer_idUnitario_reg_masvendido);
        }
    }
}
