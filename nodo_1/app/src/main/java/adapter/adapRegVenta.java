package adapter;


import static com.example.nodo_1.principal.jsonArticulos;

import android.content.Context;
import android.graphics.drawable.Drawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;
import com.example.nodo_1.pedidosAgregarReg;
import com.example.nodo_1.principal;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import helper.SwipeHelper;
public class adapRegVenta extends RecyclerView.Adapter<adapRegVenta.ViewHolder>{

    Context context;
    JSONArray array = new JSONArray();
    RecyclerView recyclerView;
    int total = 0;
    TextView total_principal;
    principal principal;
    pedidosAgregarReg pedidosAgregarReg;
    Button butCancelarVenta;
    String mayoreoAply = "mayoreoAply";
    public adapRegVenta(
            Context context,
            RecyclerView recyclerView,
            TextView total_principal,
            principal principal,
            pedidosAgregarReg pedidosAgregarReg,
            Button butCancelarVenta
            ){
        this.butCancelarVenta = butCancelarVenta;
        this.recyclerView = recyclerView;
        this.context = context;
        this.total_principal = total_principal;
        this.principal = principal;
        this.pedidosAgregarReg = pedidosAgregarReg;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_articulo_cero, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        final ConstraintLayout
                consRegPrinArt = holder.consRegPrinArt,
                consDescuento = holder.consDescuento,
                consMayoreo =holder.consMayoreoRegAdapVenta;

        final TextView
                cantidad,
                itemNombreListaVenta,
                precioUnitario,
                itemIDListaVenta,
                itemDispListaVenta,
                precioPorUnidades,
                datosList = holder.datosList,
                descripcion,
                referenciaEscrita,
                cajaCorarAp             = holder.cajaCobrarAp,
                rayaDescuento           = holder.rayaDescuento,
                precioConDescuento      = holder.precioConDescuento,
                totalConDescuento       = holder.totalConDescuento,
                textViewVar             = holder.textViewVar,
                textPrecioConDescuento  = holder.textPrecioConDescuento,
                talla                   = holder.talla,
                mayoreoUnidad = holder.mayoreoUnidad,
                mayoreoTotal = holder.mayoreoTotal;

        Button but_agregar, but_quitar, butAnimeGenero, butAccesoriosGenero, butPapeleriaGenero, butAceroGenero, but3por2;
        but_agregar                 = holder.butAgregarArtListaVenta;
        but_quitar                  = holder.butQuitarArtListaVenta;
        precioPorUnidades           = holder.itemTotalArticuloListaVenta;
        itemDispListaVenta          = holder.itemDispListaVenta;
        cantidad                    = holder.itemVentaCount;
        itemNombreListaVenta        = holder.itemNombreListaVenta;
        precioUnitario              = holder.itemPrecioListaVenta;
        itemIDListaVenta            = holder.itemIDListaVenta;
        descripcion                 = holder.descripcion;
        referenciaEscrita           = holder.referenciaEscrita;
        but3por2                    = holder.but3por2;

        textViewVar.setVisibility(View.GONE);

        try {
            JSONObject object = array.getJSONObject(position);

            if (object.has("3x2")){
                if(mostrarBoton3x2()){
                    but3por2.setVisibility(View.VISIBLE);
                    but3por2.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View view) {
                            try {
                                if (!array.getJSONObject(holder.getAdapterPosition()).has("aply_3x2")){
                                    array.getJSONObject(holder.getAdapterPosition()).put("aply_3x2", "1");
                                    array.getJSONObject(holder.getAdapterPosition()).put("cantidad", "3");
                                    sumaVenta();
                                    notifyItemChanged(holder.getAdapterPosition());
                                }
                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                        }
                    });
                }else {
                    but3por2.setVisibility(View.GONE);
                }
            }else {
                but3por2.setVisibility(View.GONE);
            }

            if(object.has("talla")){
                talla.setVisibility(View.VISIBLE);
                talla.setText(object.getString("talla"));
            }else {
                talla.setVisibility(View.GONE);
            }
            if(object.has("seña")){
                referenciaEscrita.setText(object.getString("seña"));
                referenciaEscrita.setVisibility(View.VISIBLE);
            }else referenciaEscrita.setVisibility(View.GONE);

            if (object.has("descuento")){
                rayaDescuento.setVisibility(View.VISIBLE);
                consDescuento.setVisibility(View.VISIBLE);
                precioConDescuento.setText(object.getString("descuento"));
                totalConDescuento.setText(String.valueOf(Integer.parseInt(object.getString("cantidad"))* Integer.parseInt(object.getString("descuento"))));

                if(object.has("aply_3x2")){
                    totalConDescuento.setText(String.valueOf(
                            (Integer.parseInt(object.getString("cantidad")) * Integer.parseInt(object.getString("descuento")))
                                    - Integer.parseInt(object.getString("aply_3x2")) * Integer.parseInt(object.getString("descuento"))));
                }
            }else{
                rayaDescuento.setVisibility(View.GONE);
                consDescuento.setVisibility(View.GONE);
            }

            if(object.has("numeroAp")){
                itemNombreListaVenta.setText(object.getString("descripcion"));
                precioUnitario.setText(object.getString("precio"));
                descripcion.setText("AP: "+ object.getString("nombreAP"));
                cantidad.setText("1");
            }else {
                String id = "00000000";
                if(!object.has("no_registrado"))id = object.getString("id");

                itemNombreListaVenta.setText(object.getString("nombrePublico"));
                descripcion.setText(object.getString("descripcion"));

                precioUnitario.setText(object.getString("precio"));
                cantidad.setText(object.getString("cantidad"));
                if(object.has("aply_3x2")){
                    precioPorUnidades.setText(
                            String.valueOf((Integer.parseInt(object.getString("cantidad")) - 1) * Integer.parseInt(object.getString("precio"))));
                    Drawable drawable = ContextCompat.getDrawable(context, R.drawable.red_naranja);
                    but3por2.setBackground(drawable);
                    but3por2.setText("PROMOCIÓN 3x2 APLICADA" + "   " + object.getString("aply_3x2") + " " + "veces");

                    precioPorUnidades.setText(String.valueOf(
                            (Integer.parseInt(object.getString("cantidad")) * Integer.parseInt(object.getString("precio")))
                                    - Integer.parseInt(object.getString("aply_3x2")) * Integer.parseInt(object.getString("precio"))));
                }else{
                    precioPorUnidades.setText(
                            String.valueOf(Integer.parseInt(object.getString("cantidad")) * Integer.parseInt(object.getString("precio"))));
                    Drawable drawable = ContextCompat.getDrawable(context, R.drawable.medio_red_morado);
                    but3por2.setBackground(drawable);
                    but3por2.setText("aplicar 3 x 2");
                }

                String finalId = id;
                but_agregar.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        if (!finalId.equals("00000000")) agregarMismoElemento_add(holder.getAdapterPosition(), finalId);
                        else {
                            toast("ARTICULO NO REGISTRADO, INGRESAR DE NUEVO");
                        }
                    }
                });
                but_quitar.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        try {
                            int i = Integer.parseInt(array.getJSONObject(holder.getAdapterPosition()).getString("cantidad"));
                            if(i > 1){
                                i--;
                                if(i < 3 && array.getJSONObject(holder.getAdapterPosition()).has("aply_3x2")){
                                    array.getJSONObject(holder.getAdapterPosition()).remove("aply_3x2");
                                }else {
                                    if (array.getJSONObject(holder.getAdapterPosition()).has("aply_3x2")){
                                        try {

                                            int numerador = i;
                                            int denominador = 3;
                                            if (denominador != 0 && (numerador % denominador == 0)) {
                                                array.getJSONObject(holder.getAdapterPosition()).put("aply_3x2", String.valueOf(numerador/denominador));
                                            }else {
                                                array.getJSONObject(holder.getAdapterPosition()).put("aply_3x2", String.valueOf((int) Math.floor(numerador/denominador)));
                                            }
                                        } catch (JSONException e) {
                                            throw new RuntimeException(e);
                                        }
                                    }
                                }
                                if (array.getJSONObject(holder.getAdapterPosition()).has("mayoreoAply")){
                                    array.getJSONObject(holder.getAdapterPosition()).remove("mayoreoAply");
                                }
                                array.getJSONObject(holder.getAdapterPosition()).put("cantidad", String.valueOf(i));
                                sumaVenta();
                                notifyItemChanged(holder.getAdapterPosition());
                            }
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }
                });
            }
            if(object.has("mayoreo")){
                if(object.has(mayoreoAply)) {
                    rayaDescuento.setVisibility(View.VISIBLE);
                    consMayoreo.setVisibility(View.VISIBLE);
                    mayoreoUnidad.setText(object.getString("mayoreo"));
                    mayoreoTotal.setText(String.valueOf(Integer.parseInt(object.getString("mayoreo")) * Integer.parseInt(object.getString("cantidad"))));
                }else {
                    rayaDescuento.setVisibility(View.GONE);
                    consMayoreo.setVisibility(View.GONE);
                }
            }else {
                rayaDescuento.setVisibility(View.GONE);
                consMayoreo.setVisibility(View.GONE);
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

    }
    private void toast(String s){
        generales.toast(s, context);
    }
    private void sumaVenta(){
        total = 0;
        for (int i = 0; i < array.length(); i++){
            String precio = "";
            try {
                if(array.getJSONObject(i).has("descuento") || array.getJSONObject(i).has(mayoreoAply)){
                    if(array.getJSONObject(i).has("descuento")){
                        precio = array.getJSONObject(i).getString("descuento");
                    }
                    if(array.getJSONObject(i).has("mayoreoAply")){
                        precio = array.getJSONObject(i).getString("mayoreo");
                    }
                } else {
                    precio = array.getJSONObject(i).getString("precio");
                }

                if(array.getJSONObject(i).has("aply_3x2")){
                    total = total + ((Integer.parseInt(array.getJSONObject(i).getString("cantidad")) - Integer.parseInt(
                            array.getJSONObject(i).getString("aply_3x2"))) * Integer.parseInt(precio));
                }else {
                    total = total + (Integer.parseInt(array.getJSONObject(i).getString("cantidad")) * Integer.parseInt(precio));
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        total_principal.setText(String.valueOf(total));
    }
    public void add_noReg(JSONObject object){
        array.put(object);
        sumaVenta();
        notifyItemInserted(array.length()-1);
    }
    @Override
    public int getItemCount() {
        return array.length();
    }
    public void add(JSONObject object, boolean igualArt){
        if(butCancelarVenta!=null)butCancelarVenta.setVisibility(View.VISIBLE);
        int igual = -1;
        if(array.length()  > 0){
            if (!object.has("numeroAp")){
                for (int i = 0; i < array.length(); i++){
                    try {
                        if(!array.getJSONObject(i).has("numeroAp")){
                            if ((array.getJSONObject(i).getString("id").equals(object.getString("id")) && !object.has("seña") && !object.has("talla"))
                                    || igualArt){
                                igual = i;
                                int cant = Integer.parseInt( array.getJSONObject(i).getString("cantidad")) + 1;
                                array.getJSONObject(i).put("cantidad", String.valueOf(cant));
                                if(object.has("3x2")){
                                    int numerador = cant;
                                    int denominador = 3;
                                    if (denominador != 0 && (numerador % denominador == 0)) {
                                        System.out.println("El resultado es un número entero.");
                                        array.getJSONObject(i).put("aply_3x2", String.valueOf(numerador/denominador));
                                    } else {
                                        System.out.println("El resultado no es un número entero.");
                                    }
                                }
                            }
                        }
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            }
        }
        if (igual < 0){
            array.put(object);
            sumaVenta();
            notifyItemInserted(array.length()-1);
        }else{
            sumaVenta();
            notifyItemChanged(igual);
        }
    }
    public boolean limitar_a_existencia(){
        boolean estado;
        /** 3X2 EN LA VENTA**/
        if(generales.loadData_sharedPreferences(context, "limitarVenta_a_existencia", context.getString(R.string.limitarVenta_a_existencia)).equals("0")
                ||generales.loadData_sharedPreferences(context, "limitarVenta_a_existencia", context.getString(R.string.limitarVenta_a_existencia)).equals("")
        )estado=false;
        else estado = true;
        return estado;
    }
    public boolean mostrarBoton3x2(){
        boolean estado;
        /** 3X2 EN LA VENTA**/
        if(generales.loadData_sharedPreferences(context, "2x1", context.getString(R.string.val_2x1_mostrar)).equals("0")
        ||generales.loadData_sharedPreferences(context, "2x1", context.getString(R.string.val_2x1_mostrar)).equals("")
        )estado=false;
        else estado = true;
        return estado;
    }
    public void regIgual(int index, String id){
        agregarMismoElemento_add(index, id);
    }
    public void remove(int index){
        array.remove(index);
        sumaVenta();
        if(array.length()==0){
            if(butCancelarVenta!=null)butCancelarVenta.setVisibility(View.GONE);
            if(principal != null){
                principal.eliminarElementoUltimo();
            }else {
                pedidosAgregarReg.eliminarElementoUltimo();
            }
        }
        notifyItemRemoved(index);
    }
    public void vaciar(){
        array = new JSONArray();
        sumaVenta();
        if(butCancelarVenta!=null)butCancelarVenta.setVisibility(View.GONE);
        notifyDataSetChanged();
    }
    public void llenar(JSONArray jsonArray){
        array = jsonArray;
        sumaVenta();
        notifyDataSetChanged();
    }
    SwipeHelper swipeHelper = null;
    public void swip(SwipeHelper swipeHelper){
        this.swipeHelper = swipeHelper;
    }

    public JSONArray getArray(){return array;}

    private void agregarMismoElemento_add(int index, String id){
        try {
            if (!array.getJSONObject(index).has("numeroAp")){
                boolean esatdo = false;
                int x = Integer.parseInt(
                        jsonArticulos.
                                getJSONObject(id). getString("cantidad"));

                if(x-Integer.parseInt(array.getJSONObject(index).getString("cantidad")) < 1){
                    if (limitar_a_existencia())toast("SIN ARTICULOS EN EXISTENCIA");
                }else esatdo = true;
                if(esatdo || !limitar_a_existencia()){
                    agregarPorIncrementoIgual(index);
                }
            }else toast("NO SE PUEDE AGREGAR ARTICULOS A ESTE REGISTRO");
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public void agregarPorIncrementoIgual(int index){
        try {
            if (!array.getJSONObject(index).has("numeroAp")){
                int i;
                try {
                    i = Integer.parseInt(array.getJSONObject(index).getString("cantidad"));
                    i = i + 1;

                    if(i > 2 && array.getJSONObject(index).has("3x2")){
                        int numerador = i;
                        int denominador = 3;
                        if (denominador != 0 && (numerador % denominador == 0)) {
                            System.out.println("El resultado es un número entero.");
                            array.getJSONObject(index).put("aply_3x2", String.valueOf(numerador/denominador));
                        } else {
                            System.out.println("El resultado no es un número entero.");
                        }
                    }

                    array.getJSONObject(index).put("cantidad", String.valueOf(i));
                    if(array.getJSONObject(index).has("mayoreo")){
                        if( i >= Integer.parseInt(array.getJSONObject(index).getString("cantMayoreo"))){
                            array.getJSONObject(index).put(mayoreoAply,"");
                        }
                    }
                    sumaVenta();
                    notifyItemChanged(index);
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }else toast("NO SE PUEDE AGREGAR ARTICULOS A ESTE REGISTRO");
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

    }
    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView itemVentaCount, itemNombreListaVenta, itemPrecioListaVenta,
                itemIDListaVenta, itemDispListaVenta, itemTotalArticuloListaVenta,
                datosList, descripcion, referenciaEscrita, cajaCobrarAp,
                rayaDescuento, precioConDescuento, totalConDescuento, textViewVar,
        textPrecioConDescuento, talla, mayoreoUnidad, mayoreoTotal;
        Button butAgregarArtListaVenta, butQuitarArtListaVenta, but3por2;
        ConstraintLayout consRegPrinArt, consDescuento, consMayoreoRegAdapVenta;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            consRegPrinArt              = (ConstraintLayout)itemView.findViewById(R.id.consRegPrinArt);
            itemVentaCount              = (TextView)itemView.findViewById(R.id.itemVentaCount);
            itemPrecioListaVenta        = (TextView)itemView.findViewById(R.id.itemPrecioListaVenta);
            itemNombreListaVenta        = (TextView)itemView.findViewById(R.id.itemNombreListaVenta);
            itemIDListaVenta            = (TextView)itemView.findViewById(R.id.itemIDListaVenta);
            itemDispListaVenta          = (TextView)itemView.findViewById(R.id.itemDispListaVenta);
            itemTotalArticuloListaVenta = (TextView)itemView.findViewById(R.id.itemTotalArticuloListaVenta);
            butAgregarArtListaVenta     = (Button)itemView.findViewById(R.id.butAgregarArtListaVenta);
            butQuitarArtListaVenta      = (Button)itemView.findViewById(R.id.butQuitarArtListaVenta);
            datosList                   = (TextView)itemView.findViewById(R.id.textView288);
            referenciaEscrita           = (TextView)itemView.findViewById(R.id.itemNombreListaVenta7);
            descripcion                 = (TextView)itemView.findViewById(R.id.itemNombreListaVenta4);
            cajaCobrarAp                = (TextView)itemView.findViewById(R.id.textView565);
            textViewVar                 = (TextView)itemView.findViewById(R.id.itemNombreListaVenta2);

            consDescuento               = (ConstraintLayout)itemView.findViewById(R.id.consArtConDescuento);
            rayaDescuento               = (TextView) itemView.findViewById(R.id.textView597);
            precioConDescuento          = (TextView) itemView.findViewById(R.id.textView593);
            totalConDescuento           = (TextView) itemView.findViewById(R.id.textView596);
            textPrecioConDescuento      = (TextView) itemView.findViewById(R.id.textView587);
            talla                       = (TextView) itemView.findViewById(R.id.talla_ada_venta_reg);

            but3por2                    = (Button) itemView.findViewById(R.id.but3por2);

            consMayoreoRegAdapVenta     = (ConstraintLayout) itemView.findViewById(R.id.consMayoreoRegAdapVenta);
            mayoreoUnidad               = (TextView) itemView.findViewById(R.id.textViewPreioMayoreo_reg_adap_unidad);
            mayoreoTotal                = (TextView) itemView.findViewById(R.id.textViewPreioMayoreo_reg_adap_total);


        }
    }
}
