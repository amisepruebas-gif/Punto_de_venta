package adapter;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.PopupWindow;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;

import java.util.List;

public class adap_reciclerEditAp extends RecyclerView.Adapter<adap_reciclerEditAp.ViewHolder> {
    List<String> list;
    Context context;;
    ConstraintLayout consPago, consReciclerEditAp;
    TextView itemRestaPedidos, itemTotalPedidos, txtIndicadorNoAp;
    PopupWindow popupWindow;
    String idCliente;
    public adap_reciclerEditAp(List<String> list, Context context, ConstraintLayout consPago, ConstraintLayout consReciclerEditAp,
                               TextView itemRestaPedidos, TextView itemTotalPedidos, TextView txtIndicadorNoAp, PopupWindow popupWindow, String idCliente){
        this.idCliente = idCliente;
        this.popupWindow = popupWindow;
        this.context = context;
        this.list = list;
        this.consPago = consPago;
        this.consReciclerEditAp = consReciclerEditAp;
        this.itemRestaPedidos = itemRestaPedidos;
        this.itemTotalPedidos = itemTotalPedidos;
        this.txtIndicadorNoAp = txtIndicadorNoAp;

    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.layout_reciclereditap, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull final ViewHolder holder, final int position) {
        final Button butEditApNumRecicler = holder.butEditApNumRecicler;
        butEditApNumRecicler.setText(String.valueOf(list.get(position)));
        butEditApNumRecicler.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {


            }
        });
    }
    @Override
    public int getItemCount() {
        return list.size();
    }

    void toast(String s){
        generales.toast(s, context);
    }
    private void setActicity(Class class_, String key, String msj){

    }
    public class ViewHolder extends RecyclerView.ViewHolder {
        Button butEditApNumRecicler;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            butEditApNumRecicler = (Button)itemView.findViewById(R.id.butEditApNumRecicler);
        }
    }
}
