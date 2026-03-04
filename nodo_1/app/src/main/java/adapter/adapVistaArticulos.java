package adapter;

import static com.example.nodo_1.principal.jsonArticulos;
import static com.example.nodo_1.principal.jsonDatos;
import static com.example.nodo_1.principal.jsonVentaXarticulo;

import android.content.Context;
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

import pop.pop_selec_talla;

public class adapVistaArticulos extends RecyclerView.Adapter<adapVistaArticulos.ViewHolder> {

    JSONObject obj;
    Context context;
    ConstraintLayout cosAunNoHayElementos;
    com.example.nodo_1.vistaArticulosTodos vistaArticulosTodos;
    public adapVistaArticulos(Context context, ConstraintLayout cosAunNoHayElementos, com.example.nodo_1.vistaArticulosTodos vistaArticulosTodos){
        this.context                = context;
        this.cosAunNoHayElementos   = cosAunNoHayElementos;
        this.vistaArticulosTodos    = vistaArticulosTodos;
        obj = jsonArticulos;
    }
    public void filtro(String entrada){
        obj = new JSONObject();
        if(entrada.equals("existencia")){
            for (int i = 0; i < jsonArticulos.names().length(); i++){
                try {
                    if(Integer.parseInt(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("cantidad")) > 0){
                        obj.put(jsonArticulos.names().getString(i), jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)));
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }else {
            for (int i = 0; i < jsonArticulos.names().length(); i++){
                try {
                    if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has(entrada)){
                        obj.put(jsonArticulos.names().getString(i), jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)));
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }
        notifyDataSetChanged();
    }
    public void actualiza(String id, int index){
        try {
            obj.put(id, jsonArticulos.getJSONObject(id));
            notifyItemChanged(index);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.vista_articulo, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView
                vistatodos_nombre = holder.vistatodos_nombre,
                vistatodos_id = holder.vistatodos_id,
                vistatodos_cantidad = holder.vistatodos_cantidad,
                vistatodos_compra = holder.vistatodos_compra,
                vistatodos_venta = holder.vistatodos_venta;
        TextView
                vistatodos_fecha    = holder.vistatodos_fecha,
                vistatodos_sigla    = holder.vistatodos_sigla,
                vistatodos_mayoreo  = holder.vistatodos_mayoreo,
                vistatodos_vendido  = holder.vistatodos_vendido;

        ConstraintLayout
                consDescuento   = holder.consDescuento,
                consMayoreo     = holder.consMayoreo,
                cons3x2         = holder.cons3x2,
                consTalla       = holder.consTalla,
                consSeña        = holder.consSeña;

        ConstraintLayout consIncentivosDeCompra = holder.consIncentivosDeCompra;

        Button but_editarAticulo = holder.but_editarAticulo,
                verVenta = holder.verVenta, but_ver_talla = holder.but_ver_talla;

        TextView talla_txt = holder.talla_txt;

        consDescuento   .setVisibility(View.GONE);
        consMayoreo     .setVisibility(View.GONE);
        cons3x2         .setVisibility(View.GONE);
        consTalla       .setVisibility(View.GONE);
        consSeña        .setVisibility(View.GONE);

        try {
            JSONObject object = obj.getJSONObject(obj.names().getString(position));
            vistatodos_nombre   .setText(object.getString("nombre"));
            vistatodos_id       .setText(object.getString("id"));
            vistatodos_cantidad .setText(object.getString("cantidad"));
            vistatodos_compra   .setText("$ " + object.getString("preciCompra"));
            vistatodos_venta    .setText("$ " + object.getString("precioVenta"));

            vistatodos_fecha    .setText(object.getString("fecha"));
            if(object.has("sigla")) vistatodos_sigla    .setText(object.getString("sigla"));
            else vistatodos_sigla.setText("NO TIENE");

            boolean estado = false;

            if(object.has("mayoreo")) {
                consMayoreo.setVisibility(View.VISIBLE);
                vistatodos_mayoreo   .setText("$ " + object.getString("mayoreo") + " > "  + object.getString("cantMayoreo"));
                estado = true;
            } else vistatodos_mayoreo.setText("NO TIENE");

            if(object.has("descuento")) {
                consDescuento.setVisibility(View.VISIBLE);
                estado = true;
            }
            if(object.has("izq")) {
                cons3x2.setVisibility(View.VISIBLE);
                estado = true;
            }
            if(object.has("tallas")) {
                consTalla.setVisibility(View.VISIBLE);
                estado = true;
                talla_txt.setText(jsonDatos.getJSONObject("tallas").getJSONObject(object.getString("tallas")).names().getString(0));
                but_ver_talla.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        pop_selec_talla pop_selec_talla  = new pop_selec_talla();
                        try {
                            id_editarTalla = obj.getJSONObject(obj.names().getString(holder.getAdapterPosition())).getString("id");
                            pop_selec_talla.showPopupWindow(view, adapVistaArticulos.this, holder.getAdapterPosition(),
                                    jsonDatos.getJSONObject("tallas").getJSONObject(object.getString("tallas")).names().getString(0));
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }
                });
            }
            if(object.has("seña")) {
                consSeña.setVisibility(View.VISIBLE);
                estado = true;
            }

            if(!estado)consIncentivosDeCompra.setVisibility(View.GONE);
            else consIncentivosDeCompra.setVisibility(View.VISIBLE);
            if(jsonVentaXarticulo.length() > 0){
                if (jsonVentaXarticulo.has(object.getString("id"))){
                    int cantidad = 0;
                    JSONObject obj = jsonVentaXarticulo.getJSONObject(object.getString("id"));
                    for (int x = 0; x < obj.names().length(); x++){
                        JSONArray objArray = obj.getJSONObject(obj.names().getString(x)).getJSONArray("index");
                        for (int i = 0; i < objArray.length(); i++){
                            cantidad++;
                        }
                    }
                    vistatodos_vendido  .setText(String.valueOf(cantidad));
                }else vistatodos_vendido.setText("0");
            }else vistatodos_vendido.setText("0");




            but_editarAticulo.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    try {
                        vistaArticulosTodos.setativity("ventas" , obj.getJSONObject(obj.names().getString(holder.getAdapterPosition())).getString("id"));
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            });

            verVenta.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    try {
                        vistaArticulosTodos.verPorID(obj.getJSONObject(obj.names().getString(holder.getAdapterPosition())).getString("id"));
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            });

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    String id_editarTalla = "";
    public String getId(){
        return id_editarTalla;
    }

    @Override
    public int getItemCount() {
        if(obj.length() > 0){
            cosAunNoHayElementos.setVisibility(View.GONE);
            return obj.names().length();
        }else {
            cosAunNoHayElementos.setVisibility(View.VISIBLE);
            return 0;
        }
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView vistatodos_nombre, vistatodos_id, vistatodos_cantidad, vistatodos_compra, vistatodos_venta;
        TextView vistatodos_fecha, vistatodos_sigla, vistatodos_mayoreo, vistatodos_vendido;
        ConstraintLayout consDescuento, consMayoreo, cons3x2, consTalla, consSeña;
        ConstraintLayout consIncentivosDeCompra;
        Button but_editarAticulo, verVenta, but_ver_talla;

        TextView talla_txt;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);

            vistatodos_nombre   = (TextView) itemView.findViewById(R.id.vistatodos_nombre);
            vistatodos_id       = (TextView) itemView.findViewById(R.id.vistatodos_id);
            vistatodos_cantidad = (TextView) itemView.findViewById(R.id.vistatodos_cantidad);
            vistatodos_compra   = (TextView) itemView.findViewById(R.id.vistatodos_compra);
            vistatodos_venta    = (TextView) itemView.findViewById(R.id.vistatodos_venta);

            vistatodos_fecha    = (TextView) itemView.findViewById(R.id.vistatodos_fecha);
            vistatodos_sigla    = (TextView) itemView.findViewById(R.id.vistatodos_sigla);
            vistatodos_mayoreo  = (TextView) itemView.findViewById(R.id.vistatodos_mayoreo);
            vistatodos_vendido  = (TextView) itemView.findViewById(R.id.vistatodos_vendido);

            consDescuento       = (ConstraintLayout) itemView.findViewById(R.id.consDescuento);
            consMayoreo         = (ConstraintLayout) itemView.findViewById(R.id.consMayoreo);
            cons3x2             = (ConstraintLayout) itemView.findViewById(R.id.cons3x2);
            consTalla           = (ConstraintLayout) itemView.findViewById(R.id.consTalla);
            consSeña            = (ConstraintLayout) itemView.findViewById(R.id.consSeña);

            talla_txt           = (TextView) itemView.findViewById(R.id.textView208);

            but_ver_talla       = (Button) itemView.findViewById(R.id.but_ver_tallas_reg_vista_art);

            verVenta            = (Button) itemView.findViewById(R.id.but_ver_venta_re_vista_art);

            consIncentivosDeCompra = (ConstraintLayout)itemView.findViewById(R.id.consIncentivosDeCompra);

            but_editarAticulo   = (Button) itemView.findViewById(R.id.butEditar_Art_Vista_articulo);
        }
    }
}
