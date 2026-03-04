package adapter;

import static com.example.nodo_1.principal.jsonArticulos;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Switch;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class adapter3x2 extends RecyclerView.Adapter<adapter3x2.ViewHolder> {

    JSONArray array = new JSONArray();

    public adapter3x2(){
        if(jsonArticulos.length() > 0){
            for (int i = 0; i < jsonArticulos.names().length(); i++){
                try {
                    if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has("3x2")){
                        array.put(new JSONObject(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).toString()));
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.reg3x2, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView id = holder.id, nombre = holder.nombre, referencia = holder.referencia,precio = holder.precio, cantidad = holder.cantidad;
        TextView statusSwitchTxt = holder.statusSwitchTxt;
        Switch switchstatus3x2 = holder.switchstatus3x2;

        try {
            JSONObject obj = array.getJSONObject(position);

            id          .setText(obj.getString("id"));
            nombre      .setText(obj.getString("nombre"));
            referencia  .setText(obj.getString("referencia"));
            precio      .setText(obj.getString("precioVenta"));
            cantidad    .setText(obj.getString("cantidad"));

            if (obj.has("3x2")){
                switchstatus3x2.setChecked(true);
                statusSwitchTxt.setText("ACTIVADO");
            }
            else{
                switchstatus3x2.setChecked(false);
                statusSwitchTxt.setText("DESACTIVADO");
            }
            switchstatus3x2.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    if (switchstatus3x2.isChecked())
                    {
                        try {
                            obj.put("3x2", "");
                            if(array.getJSONObject(holder.getAdapterPosition()).has("remove")){
                                array.getJSONObject(holder.getAdapterPosition()).remove("remove");
                            }
                            array.getJSONObject(holder.getAdapterPosition()).put("nuevo", "");
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }else {
                        obj.remove("3x2");

                        try {
                            if(array.getJSONObject(holder.getAdapterPosition()).has("nuevo")){
                                array.getJSONObject(holder.getAdapterPosition()).remove("nuevo");
                            }
                            array.getJSONObject(holder.getAdapterPosition()).put("remove", "");
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }
                    notifyItemChanged(holder.getAdapterPosition());
                }
            });

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    public JSONArray getArray() {
        return array;
    }

    @Override
    public int getItemCount() {
        return array.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView id, nombre, referencia,precio, cantidad, statusSwitchTxt;
        Switch switchstatus3x2;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            id          = (TextView) itemView.findViewById(R.id.txtIdreg_3x2);
            nombre      = (TextView) itemView.findViewById(R.id.nom_3x2reg);
            referencia  = (TextView) itemView.findViewById(R.id.referencia_3x2reg);
            precio      = (TextView) itemView.findViewById(R.id.precio_3x2reg);
            cantidad    = (TextView) itemView.findViewById(R.id.cant_3x2reg);

            statusSwitchTxt = (TextView)itemView.findViewById(R.id.statusSwitchTxt);
            switchstatus3x2 = (Switch) itemView.findViewById(R.id.switch_3x2reg);
        }
    }
}
