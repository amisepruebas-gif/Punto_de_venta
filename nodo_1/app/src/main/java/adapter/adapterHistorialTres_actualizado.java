package adapter;


import static com.example.nodo_1.principal.jsonClientes;
import static com.example.nodo_1.principal.jsonPedido;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class adapterHistorialTres_actualizado extends RecyclerView.Adapter<adapterHistorialTres_actualizado.ViewHolder> {

    fragmentVenta.por_fecha por_fecha_fragment;
    JSONArray               array;
    Context                 context;
    String                  estadoBusquedaID;
    public adapterHistorialTres_actualizado(
            JSONArray array,
            fragmentVenta.por_fecha por_fecha_fragment,
            Context context,
            String estadoBusquedaID){
        this.estadoBusquedaID   = estadoBusquedaID;
        this.array              = array;
        this.por_fecha_fragment = por_fecha_fragment;
        this.context            = context;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_historial_tres, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView itemDesHist_pag_3 = holder.itemDesHist_pag_3,
                itemPrecUnHist_pag_3 = holder.itemPrecUnHist_pag_3,
                itemCantHist_pag_3 = holder.itemCantHist_pag_3,
                itemTotalPecUnHist_pag_3 = holder.itemTotalPecUnHist_pag_3,
                var_escrita_o_puesta = holder.var_escrita_o_puesta,
                id = holder.id, arriculoBuscadoPorID_barrRoja = holder.arriculoBuscadoPorID_barrRoja,
                descripcion = holder.descripcion,
                talla = holder.talla, sena = holder.escrito, promoAply = holder.promoAply;
        ConstraintLayout consTallaSeña = holder.consTallaSeña;
        //Button butVerAp = holder.butVerAp;
        RecyclerView recyclerViewArAp = holder.recyclerViewArAp;
        try {

                /*
                12300039                    ç 0
                1                           ç 1
                20                          ç 2
                pin chico                   ç 3
                kpopAnimePeliculasYseries   ç 4
                pinçotro (no especificado)  ç 5
                4
                 */

            consTallaSeña.setVisibility(View.GONE);
            if(array.getJSONObject(position).has("talla")){
                talla.setVisibility(View.VISIBLE);
                consTallaSeña.setVisibility(View.VISIBLE);
                talla.setText("Talla  " + array.getJSONObject(position).getString("talla"));
            }else {
                talla.setVisibility(View.GONE);
            }
            if(array.getJSONObject(position).has("seña")){
                sena.setVisibility(View.VISIBLE);
                consTallaSeña.setVisibility(View.VISIBLE);
                sena.setText(array.getJSONObject(position).getString("seña") + "   ");
            }else {
                sena.setVisibility(View.GONE);
            }


            if (!array.getJSONObject(position).has("numeroAp")){

                recyclerViewArAp.setVisibility(View.GONE);

             /*
                txtButVerde.setVisibility(View.GONE);
                if(array.getJSONObject(position).has("surtido")){
                    consSurtidoRegistroVenta.setVisibility(View.VISIBLE);
                }else {
                    consSurtidoRegistroVenta.setVisibility(View.GONE);
                }
              */

                if(array.getJSONObject(position).has("marca")){
                    arriculoBuscadoPorID_barrRoja.setVisibility(View.VISIBLE);
                }else {
                    arriculoBuscadoPorID_barrRoja.setVisibility(View.GONE);
                }

                if(!estadoBusquedaID.equals("")) {
                    if(estadoBusquedaID.equals(array.getJSONObject(position).getString("id")))arriculoBuscadoPorID_barrRoja.setVisibility(View.VISIBLE);
                    else arriculoBuscadoPorID_barrRoja.setVisibility(View.GONE);
                } else  {
                    arriculoBuscadoPorID_barrRoja.setVisibility(View.GONE);
                    if(array.getJSONObject(position).has("marca"))arriculoBuscadoPorID_barrRoja.setVisibility(View.VISIBLE);
                }

                if(!array.getJSONObject(position).getString("id").equals("00000000") && !array.getJSONObject(position).getString("id").equals("0") ){
                    id.setText(array.getJSONObject(position).getString("id"));
                    //if(s.length()>25)s = s.substring(0, 21);

                    int estado = 0;
                    if(array.getJSONObject(position).has("nombrePublico")){
                        itemDesHist_pag_3.setText(array.getJSONObject(position).getString("nombrePublico"));
                    }else itemDesHist_pag_3.setText("S_1");

                    if(array.getJSONObject(position).has("precio")){
                        itemPrecUnHist_pag_3.setText(array.getJSONObject(position).getString("precio")); estado++;
                    }else itemPrecUnHist_pag_3.setText("S_2");

                    if(array.getJSONObject(position).has("cantidad")){
                        itemCantHist_pag_3.setText(array.getJSONObject(position).getString("cantidad"));    estado++;
                    }else itemCantHist_pag_3.setText("S_3");


                    if(estado > 1){
                        itemTotalPecUnHist_pag_3.setText(
                                String.valueOf(
                                        Integer.parseInt(array.getJSONObject(position).getString("cantidad")) * Integer.parseInt(array.getJSONObject(position).getString("precio"))
                                ));
                    }else itemTotalPecUnHist_pag_3.setText("S_4");


                    if(array.getJSONObject(position).has("descripcion")){
                        var_escrita_o_puesta.setText(array.getJSONObject(position).getString("descripcion"));
                    } else var_escrita_o_puesta.setText("");



                    String s = "";
                    //jsonArticulos.getJSONObject(array.getJSONObject(position).getString("id")).getString("itemRef");
                    descripcion.setText(s);
                    descripcion.setVisibility(View.GONE);
                    if(descripcion.length()>0 && !s.equals(" ")){
                        descripcion.setVisibility(View.VISIBLE);
                    }else {
                        descripcion.setVisibility(View.GONE);
                    }

                }
                int color;
                color = ContextCompat.getColor(context, R.color.naranja_bajo);
                arriculoBuscadoPorID_barrRoja.setBackgroundColor(color);

                JSONObject object = array.getJSONObject(position);

                promoAply.setVisibility(View.VISIBLE);
                if(object.has("aply_3x2")){
                    promoAply.setText("3 X 2");
                }else if (object.has("mayoreoAply")){
                    promoAply.setText("MAYOREO");
                }else if (object.has("descuento")){
                    promoAply.setText("DESCUENTO");
                }else {
                    promoAply.setVisibility(View.GONE);
                }
            }else {
                promoAply.setVisibility(View.GONE);
                recyclerViewArAp.setVisibility(View.VISIBLE);
                int color;
                color = ContextCompat.getColor(context, R.color.azulclaro);
                arriculoBuscadoPorID_barrRoja.setBackgroundColor(color);

                /*
                 txtButVerde.setVisibility(View.VISIBLE);
                txtButVerde.setText("VER APARTADO");
                 */

                itemDesHist_pag_3.setText("APARTADO: " + array.getJSONObject(position).getString("nombreAP"));
                String idAp = array.getJSONObject(position).getString("numeroAp");
                String idCL = jsonPedido.getJSONObject(idAp).getString("cliente");
                var_escrita_o_puesta.setText(jsonClientes.getJSONObject(idCL).getString("numeroTelefono"));
                id.setText("ARTICULOS");
                itemCantHist_pag_3.setText(String.valueOf(jsonPedido.getJSONObject(idAp).getJSONArray("articulos").length()));
                itemPrecUnHist_pag_3.setText(jsonPedido.getJSONObject(idAp).getString("total"));
                itemTotalPecUnHist_pag_3.setText(jsonPedido.getJSONObject(idAp).getString("total"));


                generales.recyclerVertical(recyclerViewArAp, context);
                adapterReg_Ap_enVenta adapterRegApEnVenta = new adapterReg_Ap_enVenta(jsonPedido.getJSONObject(idAp).getJSONArray("articulos"), context, estadoBusquedaID);
                recyclerViewArAp.setAdapter(adapterRegApEnVenta);


             /*
                butVerAp.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        try {
                            String id = array.getJSONObject(holder.getAdapterPosition()).getString("numeroAp");
                            if(ventas != null) ventas.verPedido(id);
                            if (buscar_por_id != null)buscar_por_id.verPorID(id);
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }
                });
              */
            }

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        TextView lineaRegAdapVenta = holder.lineaRegAdapVenta;
        if (position==array.length()-1)lineaRegAdapVenta.setVisibility(View.GONE);
        else lineaRegAdapVenta.setVisibility(View.VISIBLE);
    }

    @Override
    public int getItemCount() {
        return array.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView itemDesHist_pag_3, itemCantHist_pag_3 ,itemPrecUnHist_pag_3, itemTotalPecUnHist_pag_3, var_escrita_o_puesta, id, descripcion;
        TextView arriculoBuscadoPorID_barrRoja, lineaRegAdapVenta, talla, escrito;
        TextView promoAply;
        RecyclerView recyclerViewArAp;
        ConstraintLayout consTallaSeña;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            itemDesHist_pag_3           = (TextView) itemView.findViewById(R.id.itemDesHist_pag_3);
            itemPrecUnHist_pag_3        = (TextView) itemView.findViewById(R.id.itemPrecUnHist_pag_3);
            itemCantHist_pag_3          = (TextView)itemView.findViewById(R.id.itemCantHist_pag_3);
            itemTotalPecUnHist_pag_3    = (TextView)itemView.findViewById(R.id.itemTotalPecUnHist_pag_3);
            var_escrita_o_puesta        = (TextView)itemView.findViewById(R.id.itemDesHist_pag_);
            id                          = (TextView)itemView.findViewById(R.id.itemDesHist_pag_2);

            talla                       = (TextView)itemView.findViewById(R.id.itemDesHist_talla);
            escrito                     = (TextView)itemView.findViewById(R.id.itemDesHist_escrito);



            arriculoBuscadoPorID_barrRoja   = (TextView) itemView.findViewById(R.id.textViewColor_regVenta);
            recyclerViewArAp                = (RecyclerView)itemView.findViewById(R.id.recyclerArticulosAp_venta);

            descripcion = (TextView) itemView.findViewById(R.id.itemDesHist_pag_4);

            lineaRegAdapVenta       = (TextView) itemView.findViewById(R.id.lineaRegAdapVenta);

            consTallaSeña           = (ConstraintLayout) itemView.findViewById(R.id.constraintLayout_talla_seña);

            promoAply               = (TextView) itemView.findViewById(R.id.promoAply_textView);

        }
    }
}
