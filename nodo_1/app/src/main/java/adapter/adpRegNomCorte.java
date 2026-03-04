package adapter;

import static com.example.nodo_1.principal.jsonDatos;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;

public class adpRegNomCorte extends RecyclerView.Adapter<adpRegNomCorte.ViewHolder> {
    JSONArray array = new JSONArray();
    public adpRegNomCorte(){
        if(jsonDatos.length() > 0){
            try {
                if (jsonDatos.has("nombresCorte")){
                    array = new JSONArray(jsonDatos.getJSONObject("nombresCorte").getJSONArray("nombresCorte").toString());
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }

        }
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.reg_pop_nom_agr_edit, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView textV_nomCorteReg = holder.textV_nomCorteReg;
        Button butBorrar = holder.butBorrar;
        try {
            textV_nomCorteReg.setText(array.getString(position));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        butBorrar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                array.remove(holder.getAdapterPosition());
                notifyItemRemoved(holder.getAdapterPosition());
            }
        });
    }
    public JSONArray getArray(){return array;}
    public void agregar(String s){
        array.put(s);
        notifyItemInserted(array.length()-1);
    }
    @Override
    public int getItemCount() {
        return array.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView textV_nomCorteReg;
        Button butBorrar;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            textV_nomCorteReg   = (TextView) itemView.findViewById(R.id.textV_nomCorteReg);
            butBorrar           = (Button)   itemView.findViewById(R.id.butNomCorteReg);
        }
    }
}
