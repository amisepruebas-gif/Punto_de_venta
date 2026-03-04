package pop;

import static com.example.nodo_1.principal.jsonArticulos;

import android.content.Context;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;

import adapter.adap_simple_texto;
import adapter.adapterRegCantPrecioExistencia;
import com.example.nodo_1.generales;

public class popCantidadPRecios {


    Context context;
    adap_simple_texto adapSegundo;
    adapterRegCantPrecioExistencia adapPrimero;
    public void showPopupWindow(final View view) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_lista_cantidad_precios, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);

        context = popupView.getContext();
        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);


        if(jsonArticulos.length() > 0){
            RecyclerView recyclerView_uno = popupView.findViewById(R.id.reciclerpoplistacantidadprecios);
            initRecycler(recyclerView_uno);

            recyclerView_dos = popupView.findViewById(R.id.recyclerView5);
            initRecycler(recyclerView_dos);

            RecyclerView recyclerView_tres = (RecyclerView)popupView.findViewById(R.id.recyclerpoplistacantidadpreciostres);
            initRecycler(recyclerView_tres);

            adapSegundo = new adap_simple_texto();
            recyclerView_tres.setAdapter(adapSegundo);
            adapSegundo.addPop(this);

           /*
            adapPrimero = new adapterRegCantPrecioExistencia(adapSegundo, context);
            recyclerView_dos.setAdapter(adapPrimero);
            */
        }else toast("NO HAY ARTICULOS RESGISTRADOS");
    }

    RecyclerView recyclerView_dos;

    private void initRecycler(RecyclerView recyclerView){
        recyclerView.setHasFixedSize(true);
        recyclerView.setLayoutManager(new LinearLayoutManager(context));
    }
    private void toast(String s){
        generales.toast(s, context);
    }
}