package adapter;

import static com.example.nodo_1.principal.jsonArticulos;

import android.content.Context;
import android.os.Handler;
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

public class adap_reg_seña extends RecyclerView.Adapter<adap_reg_seña.ViewHolder> {

    JSONArray array = new JSONArray();

    Context context;
    public adap_reg_seña(JSONArray array, Context context){
        this.array = array;
        this.context = context;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.reg_desc_sen_a_art, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView id = holder.id, nombre = holder.nombre, caract = holder.caract,
                nuevoRe_desc = holder.nuevoRe_desc;
        ConstraintLayout consEliminarDesc_reg = holder.consEliminarDesc_reg,
                consPrincipal = holder.consPrincipal;
        Button cancelar = holder.cancelar;

        try {
            JSONObject object = array.getJSONObject(position);

            id              .setText(object.getString("id"));
            nombre          .setText(object.getString("nombre"));
            String p_uno =  object.getString(         "precioVenta");
            caract          .setText(object.getString("referencia"));



            nuevoRe_desc.setVisibility(View.VISIBLE);
            if(array.getJSONObject(position).has("nuevo")){
                nuevoRe_desc.setText("NUEVO REGISTRO");
                nuevoRe_desc.setBackground(context.getDrawable(R.drawable.medio_red_rojo_suave));
                consPrincipal.setBackground(context.getDrawable(R.drawable.medio_red_contorno_rojo));
            }
            else if(array.getJSONObject(position).has("editado")){
                nuevoRe_desc.setText("EDITADO");
                nuevoRe_desc.setBackground(context.getDrawable(R.drawable.medio_red_azul_datos_segmento));
                consPrincipal.setBackground(context.getDrawable(R.drawable.medio_red_contorno_azul));
            }
            else {
                nuevoRe_desc.setVisibility(View.GONE);
                consPrincipal.setBackground(context.getDrawable(R.drawable.blanco_medio_red));
            }
            try {
                if(array.getJSONObject(position).has("remove")){
                    consEliminarDesc_reg.setVisibility(View.VISIBLE);
                }else consEliminarDesc_reg.setVisibility(View.GONE);

                consEliminarDesc_reg.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        try {
                            array.getJSONObject(holder.getAdapterPosition()).remove("remove");
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
                        array.getJSONObject(holder.getAdapterPosition()).put("remove", "");
                        consEliminarDesc_reg.setVisibility(View.VISIBLE);
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            });
            if (position == 0){
                try {
                    if (array.getJSONObject(0).has("animacion")){
                        startDrawableBackgroundAnimation(
                                consPrincipal,(R.drawable.blanco_medio_red),
                                R.drawable.medio_red_contorno_rojo);
                        array.getJSONObject(0).remove("animacion");
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public void reset(){
        array = new JSONArray();
        for (int i = 0; i < jsonArticulos.names().length(); i++){
            try {
                if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has("seña")){
                    array.put(new JSONObject(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).toString()));
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        notifyDataSetChanged();
    }
    public void actualizarTodo(JSONArray array){
        this.array = array;
        notifyDataSetChanged();
    }
    public void setClic(int index){
        try {
            if (index < 0 || index >= array.length()) {
                throw new IllegalArgumentException("Índice fuera de rango");
            }
            Object item = array.get(index);
            array.remove(index);

            // Crear una nueva JSONArray para reconstruir el orden
            JSONArray newArray = new JSONArray();
            newArray.put(item); // Agregar el elemento al inicio
            for (int i = 0; i < array.length(); i++) {
                newArray.put(array.get(i));
            }
            array = newArray; // Reemplazar el arreglo original

            notifyItemMoved(index, 0);
            notifyItemRangeChanged(0, index + 1);
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }
    public void starAnimation(){
        try {
            array.getJSONObject(0).put("animacion", "");
            notifyItemChanged(0);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public void startDrawableBackgroundAnimation(final ConstraintLayout layout, final int drawable1ResId, final int drawable2ResId) {
        // Número total de cambios (cada cambio es un switch entre los dos drawables)
        final int totalChanges = 6; // 4 ciclos completos (cada ciclo tiene 2 cambios)
        final int duration = 500; // Duración entre cambios en milisegundos

        // Handler para programar los cambios
        final Handler handler = new Handler();
        final Runnable runnable = new Runnable() {
            int changeCount = 0;
            boolean useDrawable1 = false;

            @Override
            public void run() {
                if (changeCount < totalChanges) {
                    // Cambia el fondo
                    if (useDrawable1) {
                        layout.setBackgroundResource(drawable1ResId);
                    } else {
                        layout.setBackgroundResource(drawable2ResId);
                    }
                    // Alterna el drawable
                    useDrawable1 = !useDrawable1;
                    changeCount++;
                    // Programa el siguiente cambio
                    handler.postDelayed(this, duration);
                } else {
                    // Al finalizar, restablece el fondo a drawable1
                    layout.setBackgroundResource(drawable1ResId);
                }
            }
        };
        // Inicia el ciclo de cambios
        handler.post(runnable);
    }
    public void add(JSONObject object){
        array.put(object);
        notifyItemInserted(array.length());
    }
    public JSONArray getArray(){return array;}
    @Override
    public int getItemCount() {
        return array.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView id, nombre, caract,nuevoRe_desc;
        Button   cancelar;
        ConstraintLayout consEliminarDesc_reg, consPrincipal;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            id         = (TextView) itemView.findViewById(R.id.textView579);
            nombre     = (TextView) itemView.findViewById(R.id.textView580);
            caract     = (TextView) itemView.findViewById(R.id.textView581);
            nuevoRe_desc = (TextView) itemView.findViewById(R.id.nuevoRe_desc);

            cancelar                = (Button) itemView.findViewById(R.id.butCancelarDescuento);
            consPrincipal           = (ConstraintLayout)itemView.findViewById(R.id.consPrincipal_reg_ver_edit_desc_recy);

            consEliminarDesc_reg    = (ConstraintLayout) itemView.findViewById(R.id.consEliminarDesc_reg);
        }
    }
}
