package adapter;

import static com.example.nodo_1.principal.jsonStatusUpdate;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;


import com.example.nodo_1.R;
import com.example.nodo_1.generales;

import org.json.JSONException;
import org.json.JSONObject;

public class adap_dispo_status_recibido_update extends RecyclerView.Adapter<adap_dispo_status_recibido_update.ViewHolder> {

    Context context;
    JSONObject objectLista      = new JSONObject();
    JSONObject objectAdapter    = new JSONObject();
    public adap_dispo_status_recibido_update(Context context){
        this.context = context;
        actualizar();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.reg_dispo_status_recibido_update, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView textView_name = holder.textView_name;
        CheckBox checkBox  = holder.checkBox;
        checkBox.setEnabled(false);
        try {
            checkBox.setChecked(objectAdapter.getBoolean(objectAdapter.names().getString(position)));
            textView_name.setText(objectAdapter.names().getString(position));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public void actualizar(){
        String str_object = generales.loadData_sharedPreferences(
                context,
                context.getString(R.string.notificacion_lista),
                context.getString(R.string.notificacion_lista));
        if (!str_object.equals("")){
            try {
                objectLista = new JSONObject(str_object);
                if(jsonStatusUpdate.length() > 0){
                    for (int x = 0; x < jsonStatusUpdate.names().length(); x++){
                        boolean statusUpdate = true;
                        JSONObject user = jsonStatusUpdate.getJSONObject(jsonStatusUpdate.names().getString(x));
                        for (int y = 0; y < objectLista.names().length(); y++){
                            String nameCabecera = objectLista.names().getString(y);
                            if (user.has(nameCabecera)){
                                if(!user.getJSONObject(nameCabecera).getString("huella_verificacion").
                                        equals(objectLista.getJSONObject(nameCabecera).getString("huella"))){
                                    statusUpdate = false;
                                }
                            }else statusUpdate = false;
                        }
                        objectAdapter.put(jsonStatusUpdate.names().getString(x), statusUpdate);
                    }
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        notifyDataSetChanged();
    }
    @Override
    public int getItemCount() {
        if(objectAdapter.length() > 0){
            return objectAdapter.names().length();
        }else return 0;
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        CheckBox checkBox;
        TextView textView_name;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            checkBox        = (CheckBox) itemView.findViewById(R.id.checkBoxStatus_re_equipo);
            textView_name   = (TextView) itemView.findViewById(R.id.nom_equipo_de_trabajo_reg);
        }
    }
}
