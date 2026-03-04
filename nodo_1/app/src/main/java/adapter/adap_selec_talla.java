package adapter;

import static com.example.nodo_1.generales.recyclerVertical;
import static com.example.nodo_1.principal.jsonDatos;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;


import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import pop.pop_selec_talla;

public class adap_selec_talla extends RecyclerView.Adapter<adap_selec_talla.ViewHolder> {

    JSONObject object = new JSONObject();
    Context context;
    String tallas = "tallas";
    pop_selec_talla pop_selec_talla;
    String nameVistaArticulos = "";
    public adap_selec_talla(Context context, pop_selec_talla pop_selec_talla, String nameVistaArticulos){
        this.nameVistaArticulos = nameVistaArticulos;
        this.context = context;
        this.pop_selec_talla = pop_selec_talla;
        initJSON();
    }
    JSONArray arrayApuntador;
    private JSONObject initJSON(){
        arrayApuntador = new JSONArray();
        if(jsonDatos.length()  > 0){
            if(jsonDatos.has(tallas)){
                try {
                    for (int i = 0; i < jsonDatos.getJSONObject(tallas).names().length(); i++){
                        if(!jsonDatos.getJSONObject(tallas).names().getString(i).equals("huella")){
                            JSONObject objNameGrupo = jsonDatos.getJSONObject(tallas).getJSONObject(jsonDatos.getJSONObject(tallas).names().getString(i));
                            arrayApuntador.put(jsonDatos.getJSONObject(tallas).names().getString(i));
                            object.put(objNameGrupo.names().getString(0),
                                    objNameGrupo.getJSONArray(objNameGrupo.names().getString(0)));
                        }
                    }

                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }
        return object;
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.reg_selec_talla, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    boolean unavez = false;
    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView nameGrupo = holder.nameGrupo;
        RecyclerView recyclerView = holder.recyclerView;
        Button button = holder.button;
        CheckBox checkBox = holder.checkBox;
        try {
            nameGrupo.setText(object.names().getString(position));

            adapter.adap_selec_talla_parte_2 adap_selec_talla_parte_2 = new adap_selec_talla_parte_2(object.getJSONArray(object.names().getString(position)), context);
            recyclerVertical(recyclerView, context);
            recyclerView.setAdapter(adap_selec_talla_parte_2);

            if(indexCehckBox >= 0){
                if(indexCehckBox == position)checkBox.setChecked(true);
                else checkBox.setChecked(false);
            }else {
                checkBox.setChecked(false);
            }

            button.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    if(recyclerView.getVisibility() == View.VISIBLE){
                        button.setBackground(context.getDrawable(R.drawable.flecha_arriba));
                        recyclerView.setVisibility(View.GONE);
                    } else {
                        button.setBackground(context.getDrawable(R.drawable.flecha_abajo));
                        recyclerView.setVisibility(View.VISIBLE);
                    }
                }
            });
            if (nameVistaArticulos.equals("")){
                checkBox.setEnabled(true);
                checkBox.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        if(checkBox.isChecked()){
                            int anterior = -1;
                            if (indexCehckBox >= 0){
                                anterior = indexCehckBox;
                            }
                            indexCehckBox = holder.getAdapterPosition();
                            notifyItemChanged(anterior);
                            notifyItemChanged(indexCehckBox);
                            try {
                                JSONObject objSelec = new JSONObject();
                                objSelec.put(object.names().getString(holder.getAdapterPosition()), object.getJSONArray(object.names().getString(holder.getAdapterPosition())));
                                pop_selec_talla.selec_object(arrayApuntador.getString(holder.getAdapterPosition()));
                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                        }else {
                            if (indexCehckBox >= 0){
                                indexCehckBox = -1;
                                pop_selec_talla.reset_selec();
                            }
                            notifyItemChanged(holder.getAdapterPosition());
                        }
                    }
                });
                if (!unavez && indexEdicion >= 0){
                    unavez = true;
                    checkBox.setEnabled(true);
                    if (position == indexEdicion){
                        button.setBackground(context.getDrawable(R.drawable.flecha_abajo));
                        recyclerView.setVisibility(View.VISIBLE);
                    }else {
                        button.setBackground(context.getDrawable(R.drawable.flecha_arriba));
                        recyclerView.setVisibility(View.GONE);
                    }
                }
            }else  {
                if(nameVistaArticulos.equals(object.names().getString(position))) {
                    checkBox.setChecked(true);
                    recyclerView.setVisibility(View.VISIBLE);
                    final int final_position = position;
                    if (!unavez){
                        indexEdicion = final_position;
                        button.setBackground(context.getDrawable(R.drawable.flecha_abajo));
                        unavez = true;
                    }
                }else checkBox.setChecked(false);
                checkBox.setEnabled(false);
            }

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    int indexCehckBox = -1; int indexEdicion = -1;
    public void habilitarEdicion(){
        nameVistaArticulos = "";
        unavez = false;
        notifyDataSetChanged();
    }
    @Override
    public int getItemCount() {
        return object.names().length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView nameGrupo;
        RecyclerView recyclerView;
        Button button;
        CheckBox checkBox;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            nameGrupo       = (TextView) itemView.findViewById(R.id.textView104);
            recyclerView    = (RecyclerView) itemView.findViewById(R.id.recylcer_reg_selec_talla);
            button          = (Button) itemView.findViewById(R.id.button12);
            checkBox        = (CheckBox) itemView.findViewById(R.id.checkBox_selec_talla_reg);
        }
    }
}
