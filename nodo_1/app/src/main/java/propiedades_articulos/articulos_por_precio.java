package propiedades_articulos;

import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonArticulos;

import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.RecyclerView;


import com.example.nodo_1.R;
import com.example.nodo_1.generales;

import org.json.JSONArray;

import adapter.adapterRegCantPrecioExistencia;

public class articulos_por_precio extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.pop_lista_cantidad_precios);
        generales.initPantalla_barra_blanca_texto_negro(getWindow(), getApplicationContext());
        // Configurar la vista y los componentes del diálogo
        if (jsonArticulos.length() > 0) {
            RecyclerView recyclerView_uno = findViewById(R.id.recyclerView5);
            generales.recyclerVertical(recyclerView_uno, getApplicationContext());

            adapterRegCantPrecioExistencia  adapPrimero = new adapterRegCantPrecioExistencia(getApplicationContext(), this);
            recyclerView_uno.setAdapter(adapPrimero);
        } else {
            toast("NO HAY ARTICULOS REGISTRADOS", getApplicationContext());
        }
    }
    public void segundaVista(JSONArray array){
      pop_art_por_precio_vista_dos porPrecioVistaDos = new pop_art_por_precio_vista_dos();
      porPrecioVistaDos.showPopupWindow(getWindow().getDecorView(), array);
    }
}
