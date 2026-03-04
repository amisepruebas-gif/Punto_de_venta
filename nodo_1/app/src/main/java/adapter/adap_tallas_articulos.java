package adapter;

import static com.example.nodo_1.principal.jsonArticulos;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class adap_tallas_articulos extends RecyclerView.Adapter<adap_tallas_articulos.ViewHolder> {

    JSONArray jsonArray = new JSONArray();
    propiedades_articulos.tallas tallas;
    public adap_tallas_articulos(JSONArray array, propiedades_articulos.tallas tallas){
        this.jsonArray = array;
        this.tallas    = tallas;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.reg_tallas, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView id = holder.id, nombre = holder.nombre, caract = holder.caract, nuevoRe_desc = holder.nuevoRe_desc;
        Button  cancelar = holder.cancelar;
        ConstraintLayout consEliminarDesc_reg = holder.consEliminarDesc_reg;


        try {
            id              .setText(jsonArray.getJSONObject(position).getString("id"));
            nombre          .setText(jsonArray.getJSONObject(position).getString("nombre"));
            caract          .setText(jsonArray.getJSONObject(position).getString("referencia"));
            nuevoRe_desc.setVisibility(View.VISIBLE);
            if(jsonArray.getJSONObject(position).has("nuevo"))nuevoRe_desc.setText("NUEVO REGISTRO");
            else if(jsonArray.getJSONObject(position).has("editado"))nuevoRe_desc.setText("EDITADO");
            else nuevoRe_desc.setVisibility(View.GONE);

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }


        try {
            if(jsonArray.getJSONObject(position).has("remove")){
                consEliminarDesc_reg.setVisibility(View.VISIBLE);
            }else consEliminarDesc_reg.setVisibility(View.GONE);

            consEliminarDesc_reg.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    try {
                        jsonArray.getJSONObject(holder.getAdapterPosition()).remove("remove");
                        removeJSN.remove(String.valueOf(holder.getAdapterPosition()));
                        if(removeJSN.length() == 0)removeJSN = new JSONObject();
                        consEliminarDesc_reg.setVisibility(View.GONE);
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            });
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        cancelar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                try {
                    jsonArray.getJSONObject(holder.getAdapterPosition()).put("remove", "");
                    removeJSN.put(String.valueOf(holder.getAdapterPosition()), "");
                    consEliminarDesc_reg.setVisibility(View.VISIBLE);
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        });
    }
    JSONObject removeJSN = new JSONObject();
    public JSONObject getRemove(){return  removeJSN;}
    public void modificar(int index, String talla){
        try {
            jsonArray.getJSONObject(index).put("talla", talla);
            notifyItemChanged(index);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public JSONArray getJsonArray(){return jsonArray;}
    public void actualizar(){
        jsonArray = new JSONArray();
        for (int x = 0; x  < jsonArticulos.names().length(); x++){
            try {
                JSONObject o = new JSONObject(jsonArticulos.getJSONObject(jsonArticulos.names().getString(x)).toString());
                if(o.has("talla")){
                    jsonArray.put(o);
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        notifyDataSetChanged();
    }
    @Override
    public int getItemCount() {
        return jsonArray.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView id, nombre, caract, nuevoRe_desc;
        Button   cancelar;
        ConstraintLayout consEliminarDesc_reg;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            id         = (TextView) itemView.findViewById(R.id.textView579);
            nombre     = (TextView) itemView.findViewById(R.id.textView580);
            caract     = (TextView) itemView.findViewById(R.id.textView581);

            nuevoRe_desc = (TextView) itemView.findViewById(R.id.nuevoRe_desc);

            cancelar     = (Button) itemView.findViewById(R.id.butCancelarDescuento);

            consEliminarDesc_reg = (ConstraintLayout) itemView.findViewById(R.id.consEliminarDesc_reg);
        }
    }
}
