package adapter;

import android.content.Context;
import android.media.MediaPlayer;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;
import com.example.nodo_1.principal;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;



public class adapterVerregistroParaPedido extends RecyclerView.Adapter<adapterVerregistroParaPedido.ViewHolder> {

    List<String> list;
    //private ArrayList<String> totalPorArticulo = new ArrayList<String>();
    private Context context;
    final MediaPlayer mp;
    private TextView totalTexView, mitadAnticipo, textViewDevolucionAp;
    private int total = 0, resta = 0;
    private boolean b = false;
    ConstraintLayout consAgregueUnArticulo;


    public adapterVerregistroParaPedido(ArrayList arrayList,
                                        Context context,
                                        TextView totalTexView,
                                        TextView mitadAnticipo,
                                        int resta,
                                        TextView textViewDevolucionAp,
                                        ConstraintLayout consAgregueUnArticulo
                                        ) {
        this.consAgregueUnArticulo  = consAgregueUnArticulo;
        this.resta                  = resta;
        this.mitadAnticipo          = mitadAnticipo;
        this.totalTexView           = totalTexView;
        this.context                = context;
        this.list                   = new ArrayList(arrayList);
        this.textViewDevolucionAp   = textViewDevolucionAp;
        mp = MediaPlayer.create(context, R.raw.barcodesounduno);
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_articulo_cero, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull final ViewHolder holder, final int position) {
        final TextView itemVentaCount, itemNombreListaVenta, itemPrecioListaVenta,
                refNoRegistrado, itemDispListaVenta, itemTotalPrecioXCant, ref;
        final Button butAgregarArtListaVenta, butQuitarArtListaVenta, noReg_SupGenero;
        butAgregarArtListaVenta     = holder.butAgregarArtListaVenta;
        butQuitarArtListaVenta      = holder.butQuitarArtListaVenta;
        itemDispListaVenta          = holder.itemDispListaVenta;
        itemVentaCount              = holder.itemVentaCount;
        itemNombreListaVenta        = holder.itemNombreListaVenta;
        itemPrecioListaVenta        = holder.itemPrecioListaVenta;
        itemTotalPrecioXCant        = holder.itemTotalPrecioXCant;
        refNoRegistrado             = holder.refNoRegistrado;
        ref                         = holder.ref;


        itemTotalPrecioXCant.setText(String.valueOf(Integer.parseInt(list.get(position).split("ç")[1]) *
                Integer.parseInt(list.get(position).split("ç")[6])));
        itemNombreListaVenta.setText(list.get(position).split("ç")[0]);
        //Precio inicial del articulo
        String precio = list.get(position).split("ç")[1];
        itemPrecioListaVenta.setText(precio);

        if(list.get(position).split("ç").length >= 10 ){
            refNoRegistrado.setText(list.get(position).split("ç")[9]);
        }
        try {
            ref.setText(principal.jsonArticulos.getJSONObject(list.get(position).split("ç")[2]).getString("itemRef"));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }


        //if(position==list.size()-1)actualizarTotal(true);

        itemVentaCount.setText(list.get(position).split("ç")[6]);
        itemDispListaVenta.setText(list.get(position).split("ç")[4]);

        butAgregarArtListaVenta.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                int numero = Integer.parseInt(list.get(holder.getAdapterPosition()).split("ç")[6]) + 1;
                if(numero  <= Integer.parseInt(list.get(holder.getAdapterPosition()).split("ç")[4])){
                    list.set(holder.getAdapterPosition(), incDed(holder.getAdapterPosition(), numero));

                    itemTotalPrecioXCant.setText(String.valueOf(Integer.parseInt(list.get(holder.getAdapterPosition()).split("ç")[1]) *
                            Integer.parseInt(list.get(holder.getAdapterPosition()).split("ç")[6])));

                    itemVentaCount.setText(String.valueOf(numero));
                    mp.start();
                    if(totalTexView.getText().toString().length() > 0){
                        total = Integer.parseInt(totalTexView.getText().toString()) + Integer.parseInt(itemPrecioListaVenta.getText().toString());
                        totalTexView.setText(String.valueOf(total));
                        mitadAnticipo.setText(String.valueOf(total/2));
                    }
                }else {
                    toast("No hay mas piezas de este articulo");
                }
            }
        });
        butQuitarArtListaVenta.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                int numero = Integer.parseInt(list.get(holder.getAdapterPosition()).split("ç")[6]) - 1;
                if (numero > 0){
                    list.set(holder.getAdapterPosition(), incDed(holder.getAdapterPosition(), numero));

                    itemTotalPrecioXCant.setText(String.valueOf(Integer.parseInt(list.get(holder.getAdapterPosition()).split("ç")[1]) *
                            Integer.parseInt(list.get(holder.getAdapterPosition()).split("ç")[6])));

                    itemVentaCount.setText(String.valueOf(numero));
                    mp.start();
                    if(totalTexView.getText().toString().length() > 0){
                        total = Integer.parseInt(totalTexView.getText().toString()) - Integer.parseInt(itemPrecioListaVenta.getText().toString());
                        totalTexView.setText(String.valueOf(total));
                        mitadAnticipo.setText(String.valueOf(total/2));
                    }
                }
            }
        });
    }

    @Override
    public int getItemCount() {
        if(list.size() > 0){
            consAgregueUnArticulo.setVisibility(View.GONE);
        }else {
            consAgregueUnArticulo.setVisibility(View.VISIBLE);
        }
        return list.size();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        Button butAgregarArtListaVenta, butQuitarArtListaVenta;
        TextView  itemNombreListaVenta, itemPrecioListaVenta, itemVentaCount,
                itemDispListaVenta, itemTotalPrecioXCant, refNoRegistrado, ref;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            itemTotalPrecioXCant        = (TextView)itemView.findViewById(R.id.itemTotalArticuloListaVenta);
            itemVentaCount              = (TextView)itemView.findViewById(R.id.itemVentaCount);
            itemPrecioListaVenta        = (TextView)itemView.findViewById(R.id.itemPrecioListaVenta);
            itemNombreListaVenta        = (TextView)itemView.findViewById(R.id.itemNombreListaVenta);
            itemDispListaVenta          = (TextView)itemView.findViewById(R.id.itemDispListaVenta);
            refNoRegistrado             = (TextView)itemView.findViewById(R.id.itemNombreListaVenta7);
            ref                         = (TextView)itemView.findViewById(R.id.itemNombreListaVenta4);

            butAgregarArtListaVenta = (Button)itemView.findViewById(R.id.butAgregarArtListaVenta);
            butQuitarArtListaVenta  = (Button)itemView.findViewById(R.id.butQuitarArtListaVenta);
        }
    }

    public List<String> getList(){
        return list;
    }

    public void add_venta(String datos){// nombreçprecioçid
        list.add(datos);
        notifyDataSetChanged();
        if(resta>0)actualizarTotal();
        else {
            if(totalTexView.length() == 0)totalTexView.setText("0");
            totalTexView.setText(String.valueOf(
                    Integer.parseInt(totalTexView.getText().toString()) + (Integer.parseInt(datos.split("ç")[1]) *Integer.parseInt(datos.split("ç")[6]))
            ));
            mitadAnticipo.setText(String.valueOf((Integer.parseInt(totalTexView.getText().toString()))/2));
        }
    }


    private void actualizarTotal(){
        int total = 0;
        for (int i = 0; i < list.size(); i++){
            total = total +
                    (Integer.parseInt(list.get(i).split("ç")[1])
                            *
                            Integer.parseInt(list.get(i).split("ç")[6]));

        }
        int i = total - resta;
        if(i > -1){
            if(textViewDevolucionAp!=null)textViewDevolucionAp.setVisibility(View.GONE);
            totalTexView.setText(String.valueOf(i));
            totalTexView.setTextSize(14f);
        }   else {
            totalTexView.setText("PAGADO");
            totalTexView.setTextSize(10f);
            textViewDevolucionAp.setText("Devolución de $" + String.valueOf(total));
            textViewDevolucionAp.setVisibility(View.VISIBLE);
        }

        mitadAnticipo.setText(String.valueOf(total/2));
    }

    public void registroIgual(String id){
        int pos = 0;
        boolean pasaB = false;
        for(int i = 0; i < list.size(); i++){
            if(id.equals(list.get(i).split("ç")[2])){
                pos = i;
            }
        }
        int numero = Integer.parseInt(list.get(pos).split("ç")[6])+ 1;
        if(numero <= Integer.parseInt(list.get(pos).split("ç")[4]))pasaB = true;
        if(pasaB){
            list.set(pos, incDed(pos, numero));

            actualizarTotal();
            notifyDataSetChanged();

        }else {
            toast("No hay mas piezas de este articulo");
        }
    }
    private String incDed(int position, int numero){
        String listSplit[] = list.get(position).split("ç");
        String cambiarTexto = "";
        listSplit[6] = String.valueOf(numero);


        for (int i = 0; i < listSplit.length; i++){
            if(i==0)cambiarTexto =  listSplit[i] + "ç";
            else {
                if(i < listSplit.length-1){
                    cambiarTexto = cambiarTexto + listSplit[i] + "ç";
                }else {
                    cambiarTexto = cambiarTexto + listSplit[i];
                }

            }
        }

        return cambiarTexto;
    }
    void toast(String s){
        generales.toast(s, context);
    }

    public void remove(int posicion){
        totalTexView.setText(String.valueOf(Integer.parseInt(totalTexView.getText().toString()) -
                (Integer.parseInt(list.get(posicion).split("ç")[1]) *  Integer.parseInt(list.get(posicion).split("ç")[6]))));
        mitadAnticipo.setText(String.valueOf((Integer.parseInt(totalTexView.getText().toString())/2)));
        list.remove(posicion);
        notifyItemRemoved(posicion);
        //actualizarTotal();
    }
}
