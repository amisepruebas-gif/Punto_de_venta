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

import propiedades_articulos.mayoreo_articulos;


public class adap_mayoreo extends RecyclerView.Adapter<adap_mayoreo.ViewHolder> {
    JSONArray array = new JSONArray();
    Context context;
    mayoreo_articulos mayoreo_articulos;
    public adap_mayoreo(mayoreo_articulos mayoreo_articulos, JSONArray array){
        this.mayoreo_articulos = mayoreo_articulos;
        context = mayoreo_articulos.getApplicationContext();
        this.array = array;
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.mayoreo_articulos, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }
    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView id = holder.id, nombre = holder.nombre, caract = holder.caract,
                precioUno = holder.precioUno, precioDos = holder.precioDos,
                apartir_de = holder.apartir_de, nuevoRe_desc = holder.nuevoRe_desc;
        Button butModificar = holder.butModificar, cancelar = holder.cancelar;

        ConstraintLayout consEliminarDesc_reg = holder.consEliminarDesc_reg, consPrincipal = holder.consPrincipal;

        try {
            id              .setText(array.getJSONObject(position).getString("id"));
            nombre          .setText(array.getJSONObject(position).getString("nombre"));
            String p_uno =  array.getJSONObject(position).getString(         "precioVenta");
            caract          .setText(array.getJSONObject(position).getString("referencia"));

            precioUno       .setText(p_uno);
            precioDos       .setText(array.getJSONObject(position).getString(         "mayoreo"));
            apartir_de.setText(array.getJSONObject(position).getString(         "cantMayoreo"));

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

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }


        butModificar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                JSONObject object = new JSONObject();
                try {
                    object.put("id",             id.getText().toString());
                    object.put("nombre",         nombre.getText().toString());
                    object.put("referencia",     caract.getText().toString());
                    object.put("precioVenta",    precioUno.getText().toString());
                    object.put("mayoreo",        array.getJSONObject(holder.getAdapterPosition()).getString("mayoreo"));
                    object.put("cantMayoreo",    array.getJSONObject(holder.getAdapterPosition()).getString("cantMayoreo"));
                    object.put("index",          String.valueOf(holder.getAdapterPosition()));
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                mayoreo_articulos.editarArticulo(holder.getAdapterPosition(), object);
            }
        });

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
    public void actualzarEdicionArt(int index, JSONObject object){
        try {
            array.put(index, object);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        notifyItemChanged(index);
    }
    public void add(JSONObject object){
        JSONArray array1 = new JSONArray();
        try {
            array1.put(object);
            for (int i = 0; i < array.length(); i++){
                array1.put(array.getJSONObject(i));
            }
            array = array1;
            //notifyItemRangeChanged(0, array.length());
            notifyDataSetChanged();
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public void reset(){
        array = new JSONArray();
        for (int i = 0; i < jsonArticulos.names().length(); i++){
            try {
                if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has("mayoreo")){
                    array.put(new JSONObject(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).toString()));
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        notifyDataSetChanged();
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
    public JSONArray getArray(){return array;}
    @Override
    public int getItemCount() {
        return array.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView id, nombre, caract, precioUno, precioDos, apartir_de, nuevoRe_desc;
        Button butModificar, cancelar;
        ConstraintLayout consEliminarDesc_reg, consPrincipal;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            id         = (TextView) itemView.findViewById(R.id.textView579);
            nombre     = (TextView) itemView.findViewById(R.id.textView580);
            caract     = (TextView) itemView.findViewById(R.id.textView581);
            precioUno  = (TextView) itemView.findViewById(R.id.textView599);
            precioDos  = (TextView) itemView.findViewById(R.id.textView603);
            apartir_de = (TextView) itemView.findViewById(R.id.textView608);
            butModificar = (Button) itemView.findViewById(R.id.button193);
            nuevoRe_desc = (TextView) itemView.findViewById(R.id.nuevoRe_desc);

            cancelar     = (Button) itemView.findViewById(R.id.butCancelarDescuento);
            consPrincipal= (ConstraintLayout)itemView.findViewById(R.id.consPrincipal_reg_ver_edit_desc_recy);

            consEliminarDesc_reg = (ConstraintLayout) itemView.findViewById(R.id.consEliminarDesc_reg);
        }
    }
}
