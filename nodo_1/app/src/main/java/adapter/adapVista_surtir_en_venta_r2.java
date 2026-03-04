package adapter;

import static com.example.nodo_1.principal.jsonArticulos;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class adapVista_surtir_en_venta_r2 extends RecyclerView.Adapter<adapVista_surtir_en_venta_r2.ViewHolder> {
    JSONArray array;
    Context context;
    adapterHistorialDos adapterHistorialDos;
    public adapVista_surtir_en_venta_r2(
            JSONArray array,
            Context context,
            adapterHistorialDos adapterHistorialDos){
        this.array = array;
        this.context = context;
        this.adapterHistorialDos    = adapterHistorialDos;
        //com.example.admin_1.funcionesComunes.toast(array.toString(), context);
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.reg_surtir_en_venta_r2, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }
    private boolean estadocolor = false;
    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView cantidad = holder.cantidad, nombre = holder.nombre, descripcion = holder.descripcion, linea = holder.linea;
        CheckBox checkBoxSurtir = holder.checkBoxSurtir;
        ConstraintLayout cons = holder.cons;



        if(array.length()>1)linea.setVisibility(View.VISIBLE);
        else linea.setVisibility(View.GONE);
        try {

            if(!estadocolor){
                estadocolor = true;
                cons.setBackgroundColor(context.getResources().getColor(R.color.gris_medio));
            }else {
                estadocolor = false;
                cons.setBackgroundColor(context.getResources().getColor(R.color.gris_oscuro));
            }

            nombre      .setText(array.getJSONObject(position).getString("nombrePublico"));
            descripcion .setText(array.getJSONObject(position).getString("descripcion"));
            cantidad    .setText(array.getJSONObject(position).getString("cantidad"));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        checkBoxSurtir.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    int rastro_index_adap_1 = Integer.parseInt(array.getJSONObject(holder.getAdapterPosition()).getString("rastro_index_adap_1"));
                    int rastro_index_adap_2 = Integer.parseInt(array.getJSONObject(holder.getAdapterPosition()).getString("rastro_index_adap_2"));

                    if (checkBoxSurtir.isChecked()){

                        array.getJSONObject(holder.getAdapterPosition()).put("check", String.valueOf(holder.getAdapterPosition()));

                        adapterHistorialDos.surtirSelec_check(
                                rastro_index_adap_1,
                                rastro_index_adap_2,
                                true);

                        JSONObject object = new JSONObject();
                        JSONArray array_names = new JSONArray();
                        String id = array.getJSONObject(holder.getAdapterPosition()).getString("id");
                        int randomNumber = (int) (Math.random() * 900000) + 100000;
                        String rastro = id+String.valueOf(randomNumber);
                        object.put(                                             "rastro", rastro);
                        array.getJSONObject(holder.getAdapterPosition()).put(   "rastro", rastro);

                        object.put("id",                id);
                        object.put("cant",              "1");
                        object.put("movimiento",        "BODEGA -> TIENDA");
                        String desc = "";
                        if(jsonArticulos.has(id)){
                            object.put("desc",                jsonArticulos.getJSONObject(id).getString("itemRef"));
                        }else object.put("desc",                "null");

                        object.put("cantBodega",          String.valueOf(1));
                        object.put("cantTienda",          String.valueOf(2));
                        object.put("rastroIdVenta",       array.getJSONObject(holder.getAdapterPosition()).getString("rastroIdVenta"));
                        object.put("rastro_index_adap_2", array.getJSONObject(holder.getAdapterPosition()).getString("rastro_index_adap_2"));


                        if(array.getJSONObject(holder.getAdapterPosition()).has("variacion")){
                            String variacion =  array.getJSONObject(holder.getAdapterPosition()).getString("variacion");
                            object.put("id_devNom", variacion);
                            object.put("id_devCod",
                                    jsonArticulos.getJSONObject(id).
                                            getJSONObject("variacion").
                                            getJSONObject(variacion).
                                            getString("codigoVenta"));
                        }

                        if(array.getJSONObject(holder.getAdapterPosition()).has("var")){
                            String variacion =  array.getJSONObject(holder.getAdapterPosition()).getString("variacion");
                            String var       = array.getJSONObject(holder.getAdapterPosition()).getString("var");
                            object.put("var", array.getJSONObject(holder.getAdapterPosition()).getString("var"));
                            object.put("id_devCod",
                                    jsonArticulos.getJSONObject(id).
                                            getJSONObject("variacion").
                                            getJSONObject(variacion).
                                            getJSONObject("var").
                                            getJSONObject(var).getString("codeSubVar"));
                        }

                    }else {
                        array.getJSONObject(holder.getAdapterPosition()).remove("check");
                        adapterHistorialDos.surtirSelec_check(
                                rastro_index_adap_1,
                                rastro_index_adap_2,
                                false);
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        });
        try {
            if(array.getJSONObject(position).has("check")){
                checkBoxSurtir.setChecked(true);
            }else checkBoxSurtir.setChecked(false);

            if(array.getJSONObject(position).has("surtido")){
                checkBoxSurtir.setChecked(true); checkBoxSurtir.setEnabled(false);
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public int getItemCount() {
        return array.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView cantidad, nombre, descripcion, linea;
        CheckBox checkBoxSurtir;
        ConstraintLayout cons;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            nombre      = itemView.findViewById(R.id.textviewNombre_r);
            cantidad    = itemView.findViewById(R.id.textviewNombre_r5);
            descripcion = itemView.findViewById(R.id.textviewNombre_r3);
            linea       = itemView.findViewById(R.id.textviewNombre_r7);

            cons        = (ConstraintLayout) itemView.findViewById(R.id.cons_reg_surtir_en_venta_r2);
            checkBoxSurtir = (CheckBox) itemView.findViewById(R.id.checkBox5_surtir_enventar3);
        }
    }
}
