package adapter;

import static com.example.nodo_1.principal.jsonArticulos;

import android.content.Context;
import android.os.Handler;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.Animation;
import android.view.animation.ScaleAnimation;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import propiedades_articulos.generarDescuento;

public class adapterVErEditarDescuentos extends RecyclerView.Adapter<adapterVErEditarDescuentos.ViewHolder> {
    JSONArray jsonArray = new JSONArray();
    Context context;
    propiedades_articulos.generarDescuento generarDescuento;
    public adapterVErEditarDescuentos(Context context, generarDescuento generarDescuento){
        this.generarDescuento = generarDescuento;
        this.context = context;
        for (int i = 0; i < jsonArticulos.names().length(); i++){
            try {
                if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has("descuento")){
                    jsonArray.put(new JSONObject(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).toString()));
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.ver_editar_descuento_registro_recycler, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView id = holder.id, nombre = holder.nombre, caract = holder.caract,
                precioUno = holder.precioUno, precioDos = holder.precioDos,
                porcentaje = holder.porcentaje, nuevoRe_desc = holder.nuevoRe_desc;
        Button butModificar = holder.butModificar, cancelar = holder.cancelar;

        ConstraintLayout consEliminarDesc_reg = holder.consEliminarDesc_reg,
                consPrincipal = holder.consPrincipal, consAnimacion = holder.consAnimacion;

        try {
            id              .setText(jsonArray.getJSONObject(position).getString("id"));
            nombre          .setText(jsonArray.getJSONObject(position).getString("nombre"));
            String p_uno =  jsonArray.getJSONObject(position).getString(         "precioVenta");
            caract          .setText(jsonArray.getJSONObject(position).getString("referencia"));


            String p_dos =  jsonArray.getJSONObject(position).getString(         "descuento");

            precioUno       .setText(p_uno);
            precioDos       .setText(p_dos);

            nuevoRe_desc.setVisibility(View.VISIBLE);
            if(jsonArray.getJSONObject(position).has("nuevo")){
                nuevoRe_desc.setText("NUEVO REGISTRO");
                nuevoRe_desc.setBackground(context.getDrawable(R.drawable.medio_red_rojo_suave));
                consPrincipal.setBackground(context.getDrawable(R.drawable.medio_red_contorno_rojo));
            }
            else if(jsonArray.getJSONObject(position).has("editado")){
                nuevoRe_desc.setText("EDITADO");
                nuevoRe_desc.setBackground(context.getDrawable(R.drawable.medio_red_azul_datos_segmento));
                consPrincipal.setBackground(context.getDrawable(R.drawable.medio_red_contorno_azul));
            }
            else {
                nuevoRe_desc.setVisibility(View.GONE);
                consPrincipal.setBackground(context.getDrawable(R.drawable.blanco_medio_red));
            }

            //porcentaje.setText(String.valueOf(Math.round(100f - ((100f * Integer.parseInt(p_dos)) / Integer.parseInt(p_uno)))));
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
                    object.put("descuento",      precioDos.getText().toString());
                    object.put("index",          String.valueOf(holder.getAdapterPosition()));
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }

                generarDescuento.editarArticulo(holder.getAdapterPosition(), object);
            }
        });

        try {
            if(jsonArray.getJSONObject(position).has("remove")){
                consEliminarDesc_reg.setVisibility(View.VISIBLE);
            }else consEliminarDesc_reg.setVisibility(View.GONE);

            consEliminarDesc_reg.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    try {
                        jsonArray.getJSONObject(holder.getAdapterPosition()).remove("remove");
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
                    consEliminarDesc_reg.setVisibility(View.VISIBLE);
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        });
        if (position == 0){
            try {
                if (jsonArray.getJSONObject(0).has("animacion")){
                    startDrawableBackgroundAnimation(
                            consPrincipal,(R.drawable.blanco_medio_red),
                            R.drawable.medio_red_contorno_rojo);
                    jsonArray.getJSONObject(0).remove("animacion");
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
    }
    public void actualzarEdicionArt(int index, JSONObject object){
        try {
            jsonArray.put(index, object);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        notifyItemChanged(index);
    }
    public void add(JSONObject object){
        JSONArray array1 = new JSONArray();
        try {
            array1.put(object);
            for (int i = 0; i < jsonArray.length(); i++){
                array1.put(new JSONObject(jsonArray.getJSONObject(i).toString()));
            }
            jsonArray = array1;
            //notifyItemRangeChanged(0, array.length());
            notifyDataSetChanged();
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    @Override
    public int getItemCount() {
        return jsonArray.length();
    }
    public void setClic(int index){
        try {
            if (index < 0 || index >= jsonArray.length()) {
                throw new IllegalArgumentException("Índice fuera de rango");
            }
            Object item = jsonArray.get(index);
            jsonArray.remove(index);

            // Crear una nueva JSONArray para reconstruir el orden
            JSONArray newArray = new JSONArray();
            newArray.put(item); // Agregar el elemento al inicio
            for (int i = 0; i < jsonArray.length(); i++) {
                newArray.put(jsonArray.get(i));
            }
            jsonArray = newArray; // Reemplazar el arreglo original

            notifyItemMoved(index, 0);
            notifyItemRangeChanged(0, index + 1);
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }
    public void reset(){
        jsonArray = new JSONArray();
        for (int i = 0; i < jsonArticulos.names().length(); i++){
            try {
                if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has("descuento")){
                    jsonArray.put(new JSONObject(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).toString()));
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        notifyDataSetChanged();
    }
    public JSONArray getJsonArray() {
        return jsonArray;
    }
    public void starAnimation(){
        try {
            jsonArray.getJSONObject(0).put("animacion", "");
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

    public void startZoomAnimation(final ConstraintLayout layout) {
        // Configura la animación de zoom
        ScaleAnimation zoomAnimation = new ScaleAnimation(
                1.0f, 1.05f, // Escala inicial y final en X (de 100% a 150%)
                1.0f, 1.05f, // Escala inicial y final en Y (de 100% a 150%)
                Animation.RELATIVE_TO_SELF, 0.1f, // Pivote en el centro horizontal
                Animation.RELATIVE_TO_SELF, 0.1f  // Pivote en el centro vertical
        );

        zoomAnimation.setDuration(500); // Duración de cada mitad del ciclo (en milisegundos)
        zoomAnimation.setRepeatCount(3); // Número de repeticiones (total de 4 ciclos)
        zoomAnimation.setRepeatMode(Animation.REVERSE); // Invertir la animación en cada repetición
        zoomAnimation.setFillAfter(true); // Mantener el estado final después de la animación


        // Agregar un listener si deseas realizar acciones al finalizar la animación
        zoomAnimation.setAnimationListener(new Animation.AnimationListener() {
            @Override
            public void onAnimationStart(Animation animation) {
                // Opcional: acciones al iniciar la animación
                layout.setBackground(context.getDrawable(R.drawable.medio_red_contorno_rojo));
            }

            @Override
            public void onAnimationEnd(Animation animation) {
                // Acciones al finalizar la animación
                layout.setBackground(context.getDrawable(R.drawable.blanco_medio_red));
                layout.clearAnimation(); // Limpia la animación aplicada
            }

            @Override
            public void onAnimationRepeat(Animation animation) {
                // Opcional: acciones en cada repetición
            }
        });

        // Inicia la animación en el ConstraintLayout
        layout.startAnimation(zoomAnimation);
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView id, nombre, caract, precioUno, precioDos, porcentaje, nuevoRe_desc;
        Button butModificar, cancelar;
        ConstraintLayout consEliminarDesc_reg, consPrincipal, consAnimacion;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            id         = (TextView) itemView.findViewById(R.id.textView579);
            nombre     = (TextView) itemView.findViewById(R.id.textView580);
            caract     = (TextView) itemView.findViewById(R.id.textView581);
            precioUno  = (TextView) itemView.findViewById(R.id.textView599);
            precioDos  = (TextView) itemView.findViewById(R.id.textView603);
            porcentaje = (TextView) itemView.findViewById(R.id.textView608);
            butModificar = (Button) itemView.findViewById(R.id.button193);
            nuevoRe_desc = (TextView) itemView.findViewById(R.id.nuevoRe_desc);

            cancelar     = (Button) itemView.findViewById(R.id.butCancelarDescuento);
            consPrincipal= (ConstraintLayout)itemView.findViewById(R.id.consPrincipal_reg_ver_edit_desc_recy);

            consEliminarDesc_reg = (ConstraintLayout) itemView.findViewById(R.id.consEliminarDesc_reg);

            consAnimacion        = (ConstraintLayout) itemView.findViewById(R.id.cons_principal_reg_desc);
        }
    }
}
